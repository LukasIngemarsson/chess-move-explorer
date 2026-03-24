<script lang="ts">
	import type { Api as ChessgroundApi } from 'chessground/api';
	import type { Key } from 'chessground/types';
	import { PlayerColor } from '$lib/types';

	interface BoardProps {
		fen: string;
		orientation: PlayerColor;
		lastMove?: [string, string];
		hoverSquares?: [string, string];
	}

	interface Props {
		fen: string;
		orientation?: PlayerColor;
		lastMove?: [string, string];
		hoverSquares?: [string, string];
	}

	let { fen, orientation = PlayerColor.White, lastMove, hoverSquares }: Props = $props();

	function toChessgroundKeys(squares: [string, string] | undefined): [Key, Key] | undefined {
		return squares ? [squares[0] as Key, squares[1] as Key] : undefined;
	}

	function toAutoShapes(squares: [string, string] | undefined) {
		if (!squares) return [];
		return [{ orig: squares[0] as Key, dest: squares[1] as Key, brush: 'blue', modifiers: { lineWidth: 8 } }];
	}

	function chessboard(element: HTMLElement, initialBoardProps: BoardProps) {
		let chessgroundInstance: ChessgroundApi | null = null;
		// Store latest props so async init always uses up-to-date values.
		let latestBoardProps = initialBoardProps;

		import('chessground').then(({ Chessground }) => {
			chessgroundInstance = Chessground(element, {
				fen: latestBoardProps.fen,
				orientation: latestBoardProps.orientation,
				lastMove: toChessgroundKeys(latestBoardProps.lastMove),
				movable: { free: false, color: undefined },
				draggable: { enabled: false },
				selectable: { enabled: false },
				drawable: {
					enabled: true,
					visible: true,
					autoShapes: toAutoShapes(latestBoardProps.hoverSquares),
				},
			});
		});

		return {
			update(newBoardProps: BoardProps) {
				latestBoardProps = newBoardProps;
				chessgroundInstance?.set({
					fen: newBoardProps.fen,
					orientation: newBoardProps.orientation,
					lastMove: toChessgroundKeys(newBoardProps.lastMove),
				});
				chessgroundInstance?.setAutoShapes(toAutoShapes(newBoardProps.hoverSquares));
			},
			destroy() {
				chessgroundInstance?.destroy();
			},
		};
	}
</script>

<div use:chessboard={{ fen, orientation, lastMove, hoverSquares }} class="cg-wrap w-full aspect-square"></div>
