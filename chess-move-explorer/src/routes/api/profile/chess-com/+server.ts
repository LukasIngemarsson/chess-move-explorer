import type { RequestHandler } from '@sveltejs/kit';
import { error, json } from '@sveltejs/kit';

interface ChessComStats {
	chess_bullet?: { last: { rating: number } };
	chess_blitz?: { last: { rating: number } };
	chess_rapid?: { last: { rating: number } };
}

export interface ChessComProfile {
	username: string;
	ratings: { mode: string; rating: number | null }[];
}

const REQUEST_HEADERS = {
	'User-Agent': 'chess-move-explorer (github.com/LukasIngemarsson/chess-move-explorer)',
};

export const GET: RequestHandler = async ({ url }) => {
	const username = url.searchParams.get('username');
	if (!username) error(400, 'username is required');

	const response = await fetch(
		`https://api.chess.com/pub/player/${encodeURIComponent(username)}/stats`,
		{ headers: REQUEST_HEADERS }
	);

	if (!response.ok) {
		if (response.status === 404) error(404, `User "${username}" not found on Chess.com`);
		error(response.status, 'Failed to fetch profile from Chess.com');
	}

	const stats = await response.json() as ChessComStats;

	const ratings: { mode: string; rating: number | null }[] = [
		{ mode: 'bullet', rating: stats.chess_bullet?.last.rating ?? null },
		{ mode: 'blitz', rating: stats.chess_blitz?.last.rating ?? null },
		{ mode: 'rapid', rating: stats.chess_rapid?.last.rating ?? null },
	];

	const profile: ChessComProfile = { username, ratings };
	return json(profile);
};
