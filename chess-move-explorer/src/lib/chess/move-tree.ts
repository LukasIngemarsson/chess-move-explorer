import { Chess } from 'chess.js';

export interface MoveFrequency {
	algebraicNotation: string;
	count: number;
	/** Percentage of games from this position where this move was played. */
	percentage: number;
	winCount: number;
	drawCount: number;
	lossCount: number;
	winPercentage: number;
	drawPercentage: number;
	lossPercentage: number;
}

export interface PositionData {
	moves: MoveFrequency[];
	totalGames: number;
}

/** Keyed by normalized FEN (without move counters for position equivalence). */
export type MoveFrequencyMap = Map<string, PositionData>;

export interface FrequencyMaps {
	player: MoveFrequencyMap;
	opponent: MoveFrequencyMap;
}

export interface Game {
	moves: string;
	playerResult: 'win' | 'draw' | 'loss';
	mode: string;
}

/**
 * A game pre-processed through chess.js. Stores the normalized FEN before
 * each move so that frequency-map building requires no further chess.js calls.
 */
export interface ProcessedGame {
	/** Normalized FEN before each move, parallel to moves[]. */
	positions: string[];
	moves: string[];
	playerResult: 'win' | 'draw' | 'loss';
	mode: string;
}

interface MoveStats {
	count: number;
	wins: number;
	draws: number;
	losses: number;
}

/**
 * Run games through chess.js once to extract per-move FEN sequences.
 * This is the only place chess.js is used; all subsequent operations
 * work on the returned ProcessedGame array without further engine calls.
 *
 * Yields to the main thread every CHUNK_SIZE games so the browser can
 * keep painting (e.g. a loading spinner) during the heavy computation.
 */
export async function processGames(
	games: Game[],
	onProgress?: (partial: ProcessedGame[]) => void
): Promise<ProcessedGame[]> {
	// Yield to the browser at frame boundaries (every ~10 ms of work) so
	// the UI (e.g. a loading spinner) keeps painting smoothly.
	const FRAME_BUDGET_MS = 10;
	const result: ProcessedGame[] = [];
	let frameStart = performance.now();
	for (let i = 0; i < games.length; i++) {
		if (performance.now() - frameStart > FRAME_BUDGET_MS) {
			onProgress?.(result);
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			frameStart = performance.now();
		}
		const game = games[i];
		const chess = new Chess();
		const rawMoves = game.moves.trim().split(/\s+/).filter(Boolean);
		const positions: string[] = [];
		const validMoves: string[] = [];
		for (const move of rawMoves) {
			positions.push(normalizeFenForLookup(chess.fen()));
			try {
				chess.move(move);
				validMoves.push(move);
			} catch {
				break;
			}
		}
		if (validMoves.length > 0) {
			result.push({ positions, moves: validMoves, playerResult: game.playerResult, mode: game.mode });
		}
	}
	return result;
}

/**
 * Build frequency maps for every mode (and 'all') in a single pass over the
 * processed games. Returns a record keyed by mode string plus the key 'all'.
 * No chess.js calls — only Map operations.
 */
export function buildAllModeFrequencyMaps(
	processedGames: ProcessedGame[],
	playerColor: 'white' | 'black'
): Record<string, FrequencyMaps> {
	type CountsMap = Map<string, Map<string, MoveStats>>;

	const allPlayer: CountsMap = new Map();
	const allOpponent: CountsMap = new Map();
	const byMode: Record<string, { player: CountsMap; opponent: CountsMap }> = {};

	for (const game of processedGames) {
		if (!byMode[game.mode]) {
			byMode[game.mode] = { player: new Map(), opponent: new Map() };
		}
		const modePlayer = byMode[game.mode].player;
		const modeOpponent = byMode[game.mode].opponent;

		for (let i = 0; i < game.moves.length; i++) {
			const isPlayerMove =
				(playerColor === 'white' && i % 2 === 0) ||
				(playerColor === 'black' && i % 2 === 1);

			const fen = game.positions[i];
			const move = game.moves[i];

			// Update both the "all" map and the per-mode map in the same iteration.
			for (const targetMap of [
				isPlayerMove ? allPlayer : allOpponent,
				isPlayerMove ? modePlayer : modeOpponent,
			]) {
				const positionCounts = targetMap.get(fen) ?? new Map<string, MoveStats>();
				const existing = positionCounts.get(move) ?? { count: 0, wins: 0, draws: 0, losses: 0 };
				positionCounts.set(move, {
					count: existing.count + 1,
					wins: existing.wins + (game.playerResult === 'win' ? 1 : 0),
					draws: existing.draws + (game.playerResult === 'draw' ? 1 : 0),
					losses: existing.losses + (game.playerResult === 'loss' ? 1 : 0),
				});
				targetMap.set(fen, positionCounts);
			}
		}
	}

	const result: Record<string, FrequencyMaps> = {
		all: { player: toPositionData(allPlayer), opponent: toPositionData(allOpponent) },
	};
	for (const [mode, counts] of Object.entries(byMode)) {
		result[mode] = { player: toPositionData(counts.player), opponent: toPositionData(counts.opponent) };
	}
	return result;
}

function toPositionData(rawMoveCounts: Map<string, Map<string, MoveStats>>): MoveFrequencyMap {
	const result: MoveFrequencyMap = new Map();
	for (const [fen, positionMoveCounts] of rawMoveCounts) {
		const totalGames = [...positionMoveCounts.values()].reduce((total, stats) => total + stats.count, 0);
		const moves: MoveFrequency[] = [...positionMoveCounts.entries()]
			.map(([algebraicNotation, stats]) => {
				const winPercentage = stats.count > 0 ? Math.round((stats.wins / stats.count) * 100) : 0;
				const drawPercentage = stats.count > 0 ? Math.round((stats.draws / stats.count) * 100) : 0;
				const lossPercentage = 100 - winPercentage - drawPercentage;
				return {
					algebraicNotation,
					count: stats.count,
					percentage: Math.round((stats.count / totalGames) * 100),
					winCount: stats.wins,
					drawCount: stats.draws,
					lossCount: stats.losses,
					winPercentage,
					drawPercentage,
					lossPercentage,
				};
			})
			.sort((first, second) => second.count - first.count);
		result.set(fen, { moves, totalGames });
	}
	return result;
}

export function normalizeFenForLookup(fen: string): string {
	return fen.split(' ').slice(0, 4).join(' ');
}
