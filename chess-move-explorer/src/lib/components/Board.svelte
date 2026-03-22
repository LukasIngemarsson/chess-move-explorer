<script lang="ts">
	import type { Api as ChessgroundApi } from 'chessground/api';
	import type { Key } from 'chessground/types';

	const HOVER_BRUSH = { key: 'hv', color: '#4682b4', opacity: 0.55, lineWidth: 6 };

	interface BoardProps {
		fen: string;
		orientation: 'white' | 'black';
		lastMove?: [string, string];
		hoverSquares?: [string, string];
	}

	interface Props {
		fen: string;
		orientation?: 'white' | 'black';
		lastMove?: [string, string];
		hoverSquares?: [string, string];
	}

	let { fen, orientation = 'white', lastMove, hoverSquares }: Props = $props();

	function toChessgroundKeys(squares: [string, string] | undefined): [Key, Key] | undefined {
		return squares ? [squares[0] as Key, squares[1] as Key] : undefined;
	}

	function toAutoShapes(squares: [string, string] | undefined) {
		if (!squares) return [];
		return [{ orig: squares[0] as Key, dest: squares[1] as Key, brush: HOVER_BRUSH.key }];
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
					brushes: [HOVER_BRUSH],
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
