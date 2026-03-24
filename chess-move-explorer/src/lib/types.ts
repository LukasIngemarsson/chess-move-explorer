export const Platform = {
	Lichess: 'lichess',
	ChessCom: 'chess-com',
} as const;
export type Platform = (typeof Platform)[keyof typeof Platform];

export const PlayerColor = {
	White: 'white',
	Black: 'black',
} as const;
export type PlayerColor = (typeof PlayerColor)[keyof typeof PlayerColor];

export const PlayerResult = {
	Win: 'win',
	Draw: 'draw',
	Loss: 'loss',
} as const;
export type PlayerResult = (typeof PlayerResult)[keyof typeof PlayerResult];

export interface Profile {
	username: string;
	ratings: { mode: string; rating: number | null }[];
}
