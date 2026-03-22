import type { RequestHandler } from '@sveltejs/kit';
import { error, json } from '@sveltejs/kit';

interface LichessUser {
	id: string;
	username: string;
	perfs: Partial<Record<string, { rating: number; games: number }>>;
}

export interface LichessProfile {
	username: string;
	ratings: { mode: string; rating: number }[];
}

const DISPLAYED_MODES = ['bullet', 'blitz', 'rapid', 'classical'] as const;

export const GET: RequestHandler = async ({ url }) => {
	const username = url.searchParams.get('username');
	if (!username) error(400, 'username is required');

	const response = await fetch(`https://lichess.org/api/user/${encodeURIComponent(username)}`);

	if (!response.ok) {
		if (response.status === 404) error(404, `User "${username}" not found on Lichess`);
		error(response.status, 'Failed to fetch profile from Lichess');
	}

	const user = await response.json() as LichessUser;

	const ratings = DISPLAYED_MODES
		.map((mode) => ({ mode, rating: user.perfs[mode]?.rating }))
		.filter((entry): entry is { mode: string; rating: number } => entry.rating !== undefined);

	const profile: LichessProfile = { username: user.username, ratings };
	return json(profile);
};
