import type { RequestHandler } from '@sveltejs/kit';
import { error, json } from '@sveltejs/kit';
import type { Game } from '$lib/chess/move-tree';
import { PlayerColor, PlayerResult } from '$lib/types';

interface LichessGame {
	variant: string;
	perf: string;
	moves: string;
	winner?: PlayerColor;
}

function computePlayerResult(
	winner: PlayerColor | undefined,
	playerColor: PlayerColor
): PlayerResult {
	if (!winner) return PlayerResult.Draw;
	return winner === playerColor ? PlayerResult.Win : PlayerResult.Loss;
}

export const GET: RequestHandler = async ({ url }) => {
	const username = url.searchParams.get('username');
	const rawMax = parseInt(url.searchParams.get('max') ?? '500');
	// max=0 means "all games"; otherwise cap at 10 000 to avoid runaway requests.
	const max = rawMax === 0 ? 10_000 : Math.min(rawMax, 10_000);
	const rawColor = url.searchParams.get('color');

	if (!username) error(400, 'username is required');
	if (rawColor !== PlayerColor.White && rawColor !== PlayerColor.Black) error(400, 'color must be white or black');

	const playerColor = rawColor as PlayerColor;

	const params = new URLSearchParams({
		max: String(max),
		moves: 'true',
		clocks: 'false',
		evals: 'false',
		opening: 'false',
		color: playerColor,
	});

	const response = await fetch(
		`https://lichess.org/api/games/user/${encodeURIComponent(username)}?${params}`,
		{ headers: { Accept: 'application/x-ndjson' } }
	);

	if (!response.ok) {
		if (response.status === 404) error(404, `User "${username}" not found on Lichess`);
		error(response.status, 'Failed to fetch games from Lichess');
	}

	const text = await response.text();
	const games: Game[] = text
		.split('\n')
		.filter(Boolean)
		.map((line) => JSON.parse(line) as LichessGame)
		.filter((game) => game.variant === 'standard' && game.moves)
		.map((game) => ({
			moves: game.moves,
			playerResult: computePlayerResult(game.winner, playerColor),
			mode: game.perf,
		}));

	return json({ games });
};
