import type { RequestHandler } from '@sveltejs/kit';
import { error, json } from '@sveltejs/kit';
import type { Game } from '$lib/chess/move-tree';

interface ChessComArchivesResponse {
	archives: string[];
}

interface ChessComGame {
	pgn: string;
	time_class: string;
	rated: boolean;
}

interface ChessComArchiveResponse {
	games: ChessComGame[];
}

const REQUEST_HEADERS = {
	'User-Agent': 'chess-move-explorer (github.com/LukasIngemarsson/chess-move-explorer)',
};

function extractPgnHeaders(pgn: string): Record<string, string> {
	const headers: Record<string, string> = {};
	for (const match of pgn.matchAll(/\[(\w+)\s+"([^"]*)"\]/g)) {
		headers[match[1]] = match[2];
	}
	return headers;
}

/** Remove parenthesised variations, handling nesting. */
function removeVariations(text: string): string {
	let result = '';
	let depth = 0;
	for (const char of text) {
		if (char === '(') depth++;
		else if (char === ')') depth--;
		else if (depth === 0) result += char;
	}
	return result;
}

function extractMovesFromPgn(pgn: string): string {
	// The moves section follows the blank line after PGN headers.
	const movesSection = pgn.split(/\n\n+/).at(-1) ?? '';

	return removeVariations(movesSection)
		.replace(/\{[^}]*\}/g, '')             // remove { clock/eval comments }
		.replace(/\$\d+/g, '')                 // remove NAG symbols ($1, $2, ...)
		.replace(/[?!]+/g, '')                 // remove annotation glyphs
		.replace(/\d+\.{1,3}\s*/g, '')         // remove move numbers (1. and 1...)
		.replace(/1-0|0-1|1\/2-1\/2|\*/g, '')  // remove result token
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.join(' ');
}

function computePlayerResult(
	pgnResult: string,
	playerColor: 'white' | 'black'
): 'win' | 'draw' | 'loss' | null {
	if (pgnResult === '1/2-1/2') return 'draw';
	if (pgnResult === '1-0') return playerColor === 'white' ? 'win' : 'loss';
	if (pgnResult === '0-1') return playerColor === 'black' ? 'win' : 'loss';
	return null; // abandoned or unknown — skip
}

function normalizeGame(
	game: ChessComGame,
	username: string,
	playerColor: 'white' | 'black',
	mode: string | null
): Game | null {
	// Skip correspondence games — daily time control has very different preparation patterns.
	if (game.time_class === 'daily') return null;
	if (mode && game.time_class !== mode) return null;

	const headers = extractPgnHeaders(game.pgn);

	const playerNameInGame = playerColor === 'white' ? headers['White'] : headers['Black'];
	if (playerNameInGame?.toLowerCase() !== username.toLowerCase()) return null;

	const playerResult = computePlayerResult(headers['Result'] ?? '*', playerColor);
	if (!playerResult) return null;

	const moves = extractMovesFromPgn(game.pgn);
	if (!moves) return null;

	return { moves, playerResult };
}

export const GET: RequestHandler = async ({ url }) => {
	const username = url.searchParams.get('username');
	const max = Math.min(parseInt(url.searchParams.get('max') ?? '500'), 500);
	const rawColor = url.searchParams.get('color');
	const mode = url.searchParams.get('mode');

	if (!username) error(400, 'username is required');
	if (rawColor !== 'white' && rawColor !== 'black') error(400, 'color must be white or black');

	const playerColor = rawColor;

	const archivesResponse = await fetch(
		`https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`,
		{ headers: REQUEST_HEADERS }
	);

	if (!archivesResponse.ok) {
		if (archivesResponse.status === 404) error(404, `User "${username}" not found on Chess.com`);
		error(archivesResponse.status, 'Failed to fetch archives from Chess.com');
	}

	const { archives } = await archivesResponse.json() as ChessComArchivesResponse;
	if (archives.length === 0) return json({ games: [] });

	// Fetch the most recent archives in parallel (up to 6 months).
	const recentArchiveUrls = [...archives].reverse().slice(0, 6);
	const archiveResponses = await Promise.all(
		recentArchiveUrls.map((archiveUrl) =>
			fetch(archiveUrl, { headers: REQUEST_HEADERS })
				.then((response) => response.json() as Promise<ChessComArchiveResponse>)
				.catch((fetchError) => {
					console.error(`Failed to fetch Chess.com archive ${archiveUrl}:`, fetchError);
					return { games: [] } as ChessComArchiveResponse;
				})
		)
	);

	// Collect normalized games, most-recent-first, up to the max limit.
	const normalizedGames: Game[] = [];
	for (const { games } of archiveResponses) {
		for (const game of [...games].reverse()) {
			if (normalizedGames.length >= max) break;
			const normalized = normalizeGame(game, username, playerColor, mode);
			if (normalized) normalizedGames.push(normalized);
		}
		if (normalizedGames.length >= max) break;
	}

	return json({ games: normalizedGames });
};
