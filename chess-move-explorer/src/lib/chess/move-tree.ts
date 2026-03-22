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

export interface Game {
	moves: string;
	playerResult: 'win' | 'draw' | 'loss';
}

interface MoveStats {
	count: number;
	wins: number;
	draws: number;
	losses: number;
}

/** Strip halfmove clock and fullmove counter so transpositions match. */
function normalizeFen(fen: string): string {
	return fen.split(' ').slice(0, 4).join(' ');
}

/**
 * Build move frequency maps from games pre-filtered to a single color.
 * Returns separate maps for the player's moves and the opponent's moves so the
 * UI can show both sides while exploring a line.
 */
export function buildMoveFrequencyMap(
	games: Game[],
	playerColor: 'white' | 'black'
): { player: MoveFrequencyMap; opponent: MoveFrequencyMap } {
	const playerMoveCounts = new Map<string, Map<string, MoveStats>>();
	const opponentMoveCounts = new Map<string, Map<string, MoveStats>>();

	for (const game of games) {
		const chessInstance = new Chess();
		const movesInAlgebraicNotation = game.moves.trim().split(/\s+/).filter(Boolean);

		for (let moveIndex = 0; moveIndex < movesInAlgebraicNotation.length; moveIndex++) {
			const isPlayerMove =
				(playerColor === 'white' && moveIndex % 2 === 0) ||
				(playerColor === 'black' && moveIndex % 2 === 1);

			const targetMap = isPlayerMove ? playerMoveCounts : opponentMoveCounts;
			const normalizedFen = normalizeFen(chessInstance.fen());
			const positionMoveCounts = targetMap.get(normalizedFen) ?? new Map<string, MoveStats>();
			const algebraicNotation = movesInAlgebraicNotation[moveIndex];
			const existing = positionMoveCounts.get(algebraicNotation) ?? { count: 0, wins: 0, draws: 0, losses: 0 };

			positionMoveCounts.set(algebraicNotation, {
				count: existing.count + 1,
				wins: existing.wins + (game.playerResult === 'win' ? 1 : 0),
				draws: existing.draws + (game.playerResult === 'draw' ? 1 : 0),
				losses: existing.losses + (game.playerResult === 'loss' ? 1 : 0),
			});
			targetMap.set(normalizedFen, positionMoveCounts);

			try {
				chessInstance.move(algebraicNotation);
			} catch {
				break;
			}
		}
	}

	return {
		player: toPositionData(playerMoveCounts),
		opponent: toPositionData(opponentMoveCounts),
	};
}

export function mergeFrequencyMaps(
	firstResult: { player: MoveFrequencyMap; opponent: MoveFrequencyMap },
	secondResult: { player: MoveFrequencyMap; opponent: MoveFrequencyMap }
): { player: MoveFrequencyMap; opponent: MoveFrequencyMap } {
	return {
		player: mergeSingleMap(firstResult.player, secondResult.player),
		opponent: mergeSingleMap(firstResult.opponent, secondResult.opponent),
	};
}

function mergeSingleMap(firstMap: MoveFrequencyMap, secondMap: MoveFrequencyMap): MoveFrequencyMap {
	const combinedMoveCounts = new Map<string, Map<string, MoveStats>>();
	for (const [fen, positionData] of [...firstMap, ...secondMap]) {
		const positionMoveCounts = combinedMoveCounts.get(fen) ?? new Map<string, MoveStats>();
		for (const { algebraicNotation, winCount, drawCount, lossCount } of positionData.moves) {
			const existing = positionMoveCounts.get(algebraicNotation) ?? { count: 0, wins: 0, draws: 0, losses: 0 };
			positionMoveCounts.set(algebraicNotation, {
				count: existing.count + winCount + drawCount + lossCount,
				wins: existing.wins + winCount,
				draws: existing.draws + drawCount,
				losses: existing.losses + lossCount,
			});
		}
		combinedMoveCounts.set(fen, positionMoveCounts);
	}
	return toPositionData(combinedMoveCounts);
}

function toPositionData(rawMoveCounts: Map<string, Map<string, MoveStats>>): MoveFrequencyMap {
	const result: MoveFrequencyMap = new Map();
	for (const [fen, positionMoveCounts] of rawMoveCounts) {
		const totalGames = [...positionMoveCounts.values()].reduce((total, stats) => total + stats.count, 0);
		const moves: MoveFrequency[] = [...positionMoveCounts.entries()]
			.map(([algebraicNotation, stats]) => ({
				algebraicNotation,
				count: stats.count,
				percentage: Math.round((stats.count / totalGames) * 100),
				winCount: stats.wins,
				drawCount: stats.draws,
				lossCount: stats.losses,
				winPercentage: stats.count > 0 ? Math.round((stats.wins / stats.count) * 100) : 0,
				drawPercentage: stats.count > 0 ? Math.round((stats.draws / stats.count) * 100) : 0,
				lossPercentage: stats.count > 0 ? Math.round((stats.losses / stats.count) * 100) : 0,
			}))
			.sort((first, second) => second.count - first.count);
		result.set(fen, { moves, totalGames });
	}
	return result;
}

export function normalizeFenForLookup(fen: string): string {
	return fen.split(' ').slice(0, 4).join(' ');
}
