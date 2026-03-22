import type { RequestHandler } from '@sveltejs/kit';
import { error, json } from '@sveltejs/kit';
import type { Game } from '$lib/chess/move-tree';

interface LichessGame {
	variant: string;
	moves: string;
	winner?: 'white' | 'black';
}

function computePlayerResult(
	winner: 'white' | 'black' | undefined,
	playerColor: 'white' | 'black'
): 'win' | 'draw' | 'loss' {
	if (!winner) return 'draw';
	return winner === playerColor ? 'win' : 'loss';
}

export const GET: RequestHandler = async ({ url }) => {
	const username = url.searchParams.get('username');
	const max = Math.min(parseInt(url.searchParams.get('max') ?? '500'), 500);
	const rawColor = url.searchParams.get('color');
	const mode = url.searchParams.get('mode');

	if (!username) error(400, 'username is required');
	if (rawColor !== 'white' && rawColor !== 'black') error(400, 'color must be white or black');

	const playerColor = rawColor;

	const params = new URLSearchParams({
		max: String(max),
		moves: 'true',
		clocks: 'false',
		evals: 'false',
		opening: 'false',
		color: playerColor,
	});
	if (mode) params.set('perfType', mode);

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
		}));

	return json({ games });
};
