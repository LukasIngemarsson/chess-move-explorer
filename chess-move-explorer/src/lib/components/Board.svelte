<script lang="ts">
	import type { Api as ChessgroundApi } from 'chessground/api';
	import type { Key } from 'chessground/types';

	interface BoardProps {
		fen: string;
		orientation: 'white' | 'black';
		lastMove?: [string, string];
	}

	interface Props {
		fen: string;
		orientation?: 'white' | 'black';
		lastMove?: [string, string];
	}

	let { fen, orientation = 'white', lastMove }: Props = $props();

	function toChessgroundKeys(squares: [string, string] | undefined): [Key, Key] | undefined {
		return squares ? [squares[0] as Key, squares[1] as Key] : undefined;
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
			},
			destroy() {
				chessgroundInstance?.destroy();
			},
		};
	}
</script>

<div use:chessboard={{ fen, orientation, lastMove }} class="cg-wrap w-full aspect-square"></div>
