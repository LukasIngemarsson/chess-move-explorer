<script lang="ts">
	import { Chess } from 'chess.js';
	import Board from '$lib/components/Board.svelte';
	import MoveList from '$lib/components/MoveList.svelte';
	import {
		buildMoveFrequencyMap,
		mergeFrequencyMaps,
		normalizeFenForLookup,
		type MoveFrequencyMap,
		type PositionData,
	} from '$lib/chess/move-tree';

	// --- Form state ---
	let username = $state('');
	let color = $state<'white' | 'black' | 'both'>('white');
	let loading = $state(false);
	let errorMsg = $state('');

	// --- Explorer state ---
	let frequencyMaps = $state<{ player: MoveFrequencyMap; opponent: MoveFrequencyMap } | null>(null);
	// moveHistory is the single source of truth; board state is fully derived from it.
	let moveHistory = $state<string[]>([]);

	// --- Derived board state ---
	let boardState = $derived.by(() => {
		const chessInstance = new Chess();
		let lastMovedSquares: [string, string] | undefined;
		for (const moveNotation of moveHistory) {
			const moveResult = chessInstance.move(moveNotation);
			if (moveResult) lastMovedSquares = [moveResult.from, moveResult.to];
		}
		const sideToMove: 'white' | 'black' = chessInstance.turn() === 'w' ? 'white' : 'black';
		return { fen: chessInstance.fen(), lastMovedSquares, sideToMove };
	});

	let isPlayerTurn = $derived(color === 'both' || color === boardState.sideToMove);

	let positionData = $derived.by<PositionData>(() => {
		if (!frequencyMaps) return { moves: [], totalGames: 0 };
		const normalizedFen = normalizeFenForLookup(boardState.fen);
		const relevantMap = isPlayerTurn ? frequencyMaps.player : frequencyMaps.opponent;
		return relevantMap.get(normalizedFen) ?? { moves: [], totalGames: 0 };
	});

	let orientation = $derived<'white' | 'black'>(color === 'black' ? 'black' : 'white');

	async function fetchGamesForColor(
		playerColor: 'white' | 'black'
	): Promise<{ player: MoveFrequencyMap; opponent: MoveFrequencyMap }> {
		const response = await fetch(
			`/api/games/lichess?username=${encodeURIComponent(username)}&color=${playerColor}&max=500`
		);
		if (!response.ok) {
			const body = await response.json().catch(() => ({})) as { message?: string };
			throw new Error(body.message ?? `Error ${response.status}`);
		}
		const { games } = await response.json() as { games: { moves: string }[] };
		return buildMoveFrequencyMap(games, playerColor);
	}

	async function fetchGames(): Promise<void> {
		if (!username.trim()) return;
		loading = true;
		errorMsg = '';
		frequencyMaps = null;
		moveHistory = [];

		try {
			if (color === 'both') {
				const [whiteResult, blackResult] = await Promise.all([
					fetchGamesForColor('white'),
					fetchGamesForColor('black'),
				]);
				frequencyMaps = mergeFrequencyMaps(whiteResult, blackResult);
			} else {
				frequencyMaps = await fetchGamesForColor(color);
			}
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Something went wrong';
		} finally {
			loading = false;
		}
	}

	function playMove(algebraicNotation: string): void {
		moveHistory = [...moveHistory, algebraicNotation];
	}

	function stepBack(): void {
		moveHistory = moveHistory.slice(0, -1);
	}

	function reset(): void {
		moveHistory = [];
	}
</script>

<svelte:head>
	<title>Chess Move Explorer</title>
</svelte:head>

<main class="min-h-screen bg-base-200 p-6">
	<div class="max-w-5xl mx-auto flex flex-col gap-6">

		<!-- Header + form -->
		<div class="card bg-base-100 shadow">
			<div class="card-body">
				<h1 class="card-title text-2xl">Chess Move Explorer</h1>
				<p class="text-base-content/60 text-sm">
					Analyse your move tendencies by position across your Lichess games.
				</p>

				<form
					class="flex flex-wrap gap-3 mt-2"
					onsubmit={(e) => { e.preventDefault(); fetchGames(); }}
				>
					<input
						class="input input-bordered flex-1 min-w-48"
						type="text"
						placeholder="Lichess username"
						bind:value={username}
					/>

					<select class="select select-bordered" bind:value={color}>
						<option value="white">As white</option>
						<option value="black">As black</option>
						<option value="both">Both colors</option>
					</select>

					<button class="btn btn-primary" type="submit" disabled={loading || !username.trim()}>
						{#if loading}
							<span class="loading loading-spinner loading-sm"></span>
							Loading…
						{:else}
							Analyse
						{/if}
					</button>
				</form>

				{#if errorMsg}
					<div class="alert alert-error mt-2">
						<span>{errorMsg}</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- Explorer -->
		{#if frequencyMaps}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">

				<!-- Board + nav -->
				<div class="card bg-base-100 shadow">
					<div class="card-body gap-4">
						<Board fen={boardState.fen} {orientation} lastMove={boardState.lastMovedSquares} />

						{#if moveHistory.length > 0}
							<p class="text-sm font-mono text-base-content/60 break-all">
								{moveHistory.join(' ')}
							</p>
						{/if}

						<div class="flex gap-2">
							<button class="btn btn-sm btn-ghost" onclick={stepBack} disabled={moveHistory.length === 0}>
								← Back
							</button>
							<button class="btn btn-sm btn-ghost" onclick={reset} disabled={moveHistory.length === 0}>
								Reset
							</button>
						</div>
					</div>
				</div>

				<!-- Move list -->
				<div class="card bg-base-100 shadow">
					<div class="card-body">
						<h2 class="card-title text-base">
							{isPlayerTurn ? 'Your moves from here' : "Opponent's replies"}
						</h2>
						<MoveList
							moves={positionData.moves}
							totalGames={positionData.totalGames}
							onSelect={playMove}
						/>
					</div>
				</div>

			</div>
		{/if}

	</div>
</main>
