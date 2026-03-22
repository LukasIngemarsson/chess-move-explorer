import type { RequestHandler } from '@sveltejs/kit';
import { error, json } from '@sveltejs/kit';

interface LichessGame {
	id: string;
	rated: boolean;
	variant: string;
	speed: string;
	status: string;
	moves: string;
	players: {
		white: { user?: { name: string } };
		black: { user?: { name: string } };
	};
}

export const GET: RequestHandler = async ({ url }) => {
	const username = url.searchParams.get('username');
	const max = Math.min(parseInt(url.searchParams.get('max') ?? '500'), 500);
	const color = url.searchParams.get('color') as 'white' | 'black' | null;

	if (!username) {
		error(400, 'username is required');
	}

	const params = new URLSearchParams({
		max: String(max),
		moves: 'true',
		clocks: 'false',
		evals: 'false',
		opening: 'false',
	});

	if (color === 'white' || color === 'black') {
		params.set('color', color);
	}

	const response = await fetch(
		`https://lichess.org/api/games/user/${encodeURIComponent(username)}?${params}`,
		{
			headers: { Accept: 'application/x-ndjson' },
		}
	);

	if (!response.ok) {
		if (response.status === 404) error(404, `User "${username}" not found on Lichess`);
		error(response.status, 'Failed to fetch games from Lichess');
	}

	const text = await response.text();
	const games: LichessGame[] = text
		.split('\n')
		.filter(Boolean)
		.map((line) => JSON.parse(line))
		.filter((g: LichessGame) => g.variant === 'standard' && g.moves);

	return json({ games, username });
};
