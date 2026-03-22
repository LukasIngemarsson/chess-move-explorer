<script lang="ts">
	import { Chess } from 'chess.js';
	import Board from '$lib/components/Board.svelte';
	import MoveList from '$lib/components/MoveList.svelte';
	import {
		buildMoveFrequencyMap,
		normalizeFenForLookup,
		type Game,
		type PositionData,
	} from '$lib/chess/move-tree';

	type Platform = 'lichess' | 'chess-com';

	interface Profile {
		username: string;
		ratings: { mode: string; rating: number | null }[];
	}

	// --- Form state ---
	let username = $state('');
	let platform = $state<Platform>('lichess');
	let playerColor = $state<'white' | 'black'>('white');
	// 0 = all games
	let maxGames = $state(500);
	let loading = $state(false);
	let errorMessage = $state('');

	// --- Profile state ---
	let profile = $state<Profile | null>(null);
	let selectedMode = $state<string | null>(null);

	// --- Games cache: keyed by color, populated on demand ---
	let gamesByColor = $state<Partial<Record<'white' | 'black', Game[]>>>({});

	// --- Derived frequency maps: recomputed instantly when mode or cached games change ---
	let frequencyMaps = $derived.by(() => {
		const games = gamesByColor[playerColor];
		if (!games) return null;
		const filtered = selectedMode ? games.filter((game) => game.mode === selectedMode) : games;
		return buildMoveFrequencyMap(filtered, playerColor);
	});

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

	let isPlayerTurn = $derived(playerColor === boardState.sideToMove);

	let positionData = $derived.by<PositionData>(() => {
		if (!frequencyMaps) return { moves: [], totalGames: 0 };
		const normalizedFen = normalizeFenForLookup(boardState.fen);
		const relevantMap = isPlayerTurn ? frequencyMaps.player : frequencyMaps.opponent;
		return relevantMap.get(normalizedFen) ?? { moves: [], totalGames: 0 };
	});

	let orientation = $derived<'white' | 'black'>(playerColor);

	let profileUrl = $derived(
		profile
			? platform === 'lichess'
				? `https://lichess.org/@/${encodeURIComponent(profile.username)}`
				: `https://www.chess.com/member/${encodeURIComponent(profile.username)}`
			: null
	);

	async function search(): Promise<void> {
		if (!username.trim()) return;
		profile = null;
		gamesByColor = {};
		selectedMode = null;
		moveHistory = [];
		errorMessage = '';

		const gamesApiPath = platform === 'lichess' ? '/api/games/lichess' : '/api/games/chess-com';
		const profileApiPath = platform === 'lichess' ? '/api/profile/lichess' : '/api/profile/chess-com';
		const encodedUsername = encodeURIComponent(username);

		loading = true;
		try {
			const makeGamesParams = (color: 'white' | 'black') =>
				new URLSearchParams({ username, color, max: String(maxGames) });

			const [whiteResponse, blackResponse, profileResponse] = await Promise.all([
				fetch(`${gamesApiPath}?${makeGamesParams('white')}`),
				fetch(`${gamesApiPath}?${makeGamesParams('black')}`),
				fetch(`${profileApiPath}?username=${encodedUsername}`),
			]);

			// Use the response for the initially selected color to detect errors.
			const primaryResponse = playerColor === 'white' ? whiteResponse : blackResponse;
			if (!primaryResponse.ok) {
				const body = await primaryResponse.json().catch(() => ({})) as { message?: string };
				throw new Error(body.message ?? `Error ${primaryResponse.status}`);
			}

			const [{ games: whiteGames }, { games: blackGames }] = await Promise.all([
				whiteResponse.json() as Promise<{ games: Game[] }>,
				blackResponse.json() as Promise<{ games: Game[] }>,
			]);
			gamesByColor = { white: whiteGames, black: blackGames };

			if (profileResponse.ok) {
				profile = await profileResponse.json() as Profile;
			}
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			loading = false;
		}
	}

	function resetExplorer(): void {
		gamesByColor = {};
		moveHistory = [];
		profile = null;
		selectedMode = null;
	}

	function selectMode(mode: string): void {
		selectedMode = selectedMode === mode ? null : mode;
	}

	function selectColor(color: 'white' | 'black'): void {
		if (playerColor === color) return;
		playerColor = color;
		moveHistory = [];
		selectedMode = null;
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
			<div class="card-body items-center text-center">
				<h1 class="card-title text-2xl">Chess Move Explorer</h1>
				<p class="text-base-content/60 text-sm">
					Analyze your move tendencies by position across your games.
				</p>

				<form
					class="flex flex-col items-center gap-2 mt-2"
					onsubmit={(e) => { e.preventDefault(); search(); }}
				>
					<div class="flex flex-wrap gap-3 justify-center">
						<!-- Platform toggle -->
						<div class="join">
							<button
								type="button"
								class="join-item btn btn-sm {platform === 'lichess' ? 'btn-primary' : ''}"
								onclick={() => { platform = 'lichess'; resetExplorer(); }}
							>
								Lichess
							</button>
							<button
								type="button"
								class="join-item btn btn-sm {platform === 'chess-com' ? 'btn-primary' : ''}"
								onclick={() => { platform = 'chess-com'; resetExplorer(); }}
							>
								Chess.com
							</button>
						</div>

						<input
							class="input input-bordered input-sm w-64"
							type="text"
							placeholder="{platform === 'lichess' ? 'Lichess' : 'Chess.com'} username"
							bind:value={username}
						/>

						<button class="btn btn-sm btn-primary w-24" type="submit" disabled={loading || !username.trim()}>
							{#if loading}
								<span class="loading loading-spinner loading-xs"></span>
								Loading…
							{:else}
								Analyze
							{/if}
						</button>
					</div>

					<div class="flex items-center gap-2">
						<span class="text-xs text-base-content/50">Load up to</span>
						<select class="select select-bordered select-xs" bind:value={maxGames}>
							<option value={100}>100 games</option>
							<option value={200}>200 games</option>
							<option value={500}>500 games</option>
							<option value={1000}>1 000 games</option>
							<option value={2000}>2 000 games</option>
							<option value={0}>All games</option>
						</select>
					</div>
				</form>

				</div>
		</div>

		{#if errorMessage}
			<div class="alert alert-error shadow">
				<span>{errorMessage}</span>
			</div>
		{/if}

		<!-- Profile card -->
		{#if profile}
			<div class="card bg-base-100 shadow">
				<div class="card-body py-3 flex-row flex-wrap items-center gap-4">
					<a href={profileUrl} target="_blank" rel="noopener noreferrer" class="font-semibold link link-hover">
						{profile.username}
					</a>
					<div class="join">
						<button
							type="button"
							class="join-item btn btn-xs {playerColor === 'white' ? 'btn-primary' : ''}"
							onclick={() => selectColor('white')}
						>
							White
						</button>
						<button
							type="button"
							class="join-item btn btn-xs {playerColor === 'black' ? 'btn-primary' : ''}"
							onclick={() => selectColor('black')}
						>
							Black
						</button>
					</div>
					<div class="flex flex-wrap gap-2">
						{#each profile.ratings as { mode, rating }}
							{#if rating !== null}
								<button
									type="button"
									class="badge gap-1 cursor-pointer {selectedMode === mode ? 'badge-primary' : 'badge-ghost'}"
									onclick={() => selectMode(mode)}
									title="{selectedMode === mode ? 'Click to show all modes' : `Click to filter by ${mode}`}"
								>
									<span class="capitalize">{mode}</span>
									<span class="font-mono font-semibold">{rating}</span>
								</button>
							{:else}
								<span class="badge badge-ghost gap-1 opacity-40" title="No {mode} games played">
									<span class="capitalize">{mode}</span>
									<span class="font-mono">—</span>
								</span>
							{/if}
						{/each}
					</div>
					{#if selectedMode}
						<span class="text-sm text-base-content/60">Showing {selectedMode} only</span>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Explorer -->
		{#if gamesByColor[playerColor]}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">

				<!-- Board + navigation -->
				<div class="card bg-base-100 shadow">
					<div class="card-body gap-4">
						<Board fen={boardState.fen} {orientation} lastMove={boardState.lastMovedSquares} />

						{#if moveHistory.length > 0}
							<p class="text-sm font-mono text-base-content/60 break-all">
								{moveHistory.join(' ')}
							</p>
						{/if}

						<div class="flex gap-2">
							<button
								class="btn btn-sm btn-ghost"
								onclick={stepBack}
								disabled={moveHistory.length === 0}
							>
								← Back
							</button>
							<button
								class="btn btn-sm btn-ghost"
								onclick={reset}
								disabled={moveHistory.length === 0}
							>
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
