import { Chess } from 'chess.js';

export interface MoveFrequency {
	algebraicNotation: string;
	count: number;
	percentage: number;
}

export interface PositionData {
	moves: MoveFrequency[];
	totalGames: number;
}

/** Keyed by FEN (without move counters for position equivalence). */
export type MoveFrequencyMap = Map<string, PositionData>;

interface Game {
	moves: string;
}

/** Strip halfmove clock and fullmove counter so transpositions match. */
function normalizeFen(fen: string): string {
	return fen.split(' ').slice(0, 4).join(' ');
}

/**
 * Build move frequency maps from games pre-filtered by Lichess to a single color.
 * Returns separate maps for the player's moves and the opponent's moves so the
 * UI can show both sides while exploring a line.
 */
export function buildMoveFrequencyMap(
	games: Game[],
	playerColor: 'white' | 'black'
): { player: MoveFrequencyMap; opponent: MoveFrequencyMap } {
	const playerMoveCounts = new Map<string, Map<string, number>>();
	const opponentMoveCounts = new Map<string, Map<string, number>>();

	for (const game of games) {
		const chessInstance = new Chess();
		const movesInAlgebraicNotation = game.moves.trim().split(/\s+/).filter(Boolean);

		for (let moveIndex = 0; moveIndex < movesInAlgebraicNotation.length; moveIndex++) {
			const isPlayerMove =
				(playerColor === 'white' && moveIndex % 2 === 0) ||
				(playerColor === 'black' && moveIndex % 2 === 1);

			const targetMap = isPlayerMove ? playerMoveCounts : opponentMoveCounts;
			const normalizedFen = normalizeFen(chessInstance.fen());
			const positionMoveCounts = targetMap.get(normalizedFen) ?? new Map<string, number>();
			const algebraicNotation = movesInAlgebraicNotation[moveIndex];
			positionMoveCounts.set(algebraicNotation, (positionMoveCounts.get(algebraicNotation) ?? 0) + 1);
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
	const combinedMoveCounts = new Map<string, Map<string, number>>();
	for (const [fen, positionData] of [...firstMap, ...secondMap]) {
		const positionMoveCounts = combinedMoveCounts.get(fen) ?? new Map<string, number>();
		for (const { algebraicNotation, count } of positionData.moves) {
			positionMoveCounts.set(algebraicNotation, (positionMoveCounts.get(algebraicNotation) ?? 0) + count);
		}
		combinedMoveCounts.set(fen, positionMoveCounts);
	}
	return toPositionData(combinedMoveCounts);
}

function toPositionData(rawMoveCounts: Map<string, Map<string, number>>): MoveFrequencyMap {
	const result: MoveFrequencyMap = new Map();
	for (const [fen, positionMoveCounts] of rawMoveCounts) {
		const totalGames = [...positionMoveCounts.values()].reduce((total, count) => total + count, 0);
		const moves: MoveFrequency[] = [...positionMoveCounts.entries()]
			.map(([algebraicNotation, count]) => ({
				algebraicNotation,
				count,
				percentage: Math.round((count / totalGames) * 100),
			}))
			.sort((first, second) => second.count - first.count);
		result.set(fen, { moves, totalGames });
	}
	return result;
}

export function normalizeFenForLookup(fen: string): string {
	return fen.split(' ').slice(0, 4).join(' ');
}
