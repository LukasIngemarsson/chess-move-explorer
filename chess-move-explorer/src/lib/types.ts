export type Platform = 'lichess' | 'chess-com';

export interface Profile {
	username: string;
	ratings: { mode: string; rating: number | null }[];
}
