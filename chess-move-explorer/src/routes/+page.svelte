<script lang="ts">
	import { Chess } from 'chess.js';
	import Board from '$lib/components/Board.svelte';
	import MoveList from '$lib/components/MoveList.svelte';
	import {
		processGames,
		buildAllModeFrequencyMaps,
		normalizeFenForLookup,
		type BuildSignal,
		type Game,
		type ProcessedGame,
		type FrequencyMaps,
		type PositionData,
	} from '$lib/chess/move-tree';

	type Platform = 'lichess' | 'chess-com';

	interface Profile {
		username: string;
		ratings: { mode: string; rating: number | null }[];
	}

	// --- Form state ---
	let username = $state('');
	let platform = $state<Platform>('chess-com');
	let playerColor = $state<'white' | 'black'>('white');
	// 0 = all games
	let maxGames = $state(500);
	let loading = $state(false);
	let loadingStatus = $state('');
	let loadingElapsed = $state(0);
	let loadingProgress = $state(0);
	let boardCardHeight = $state(0);
	let errorMessage = $state('');

	// --- Profile state ---
	let profile = $state<Profile | null>(null);
	let selectedMode = $state<string | null>(null);

	// --- Processed games cache: chess.js runs once on load, results stored here ---
	let processedGamesByColor = $state<Partial<Record<'white' | 'black', ProcessedGame[]>>>({});

	// --- Pre-computed maps for every mode per color; rebuilt async to avoid blocking the main thread ---
	let allModeMapsByColor = $state<Partial<Record<'white' | 'black', Record<string, FrequencyMaps>>>>({});
	let _buildSignal: BuildSignal = { cancelled: false };

	async function rebuildMaps(games: Partial<Record<'white' | 'black', ProcessedGame[]>>) {
		_buildSignal.cancelled = true;
		const signal = (_buildSignal = { cancelled: false });
		const result: typeof allModeMapsByColor = {};
		for (const color of ['white', 'black'] as const) {
			const processed = games[color];
			if (processed?.length) {
				const maps = await buildAllModeFrequencyMaps(processed, color, signal);
				if (signal.cancelled) return;
				result[color] = maps!;
			}
		}
		allModeMapsByColor = result;
	}


	// --- Active frequency maps: instant lookup, no computation ---
	let frequencyMaps = $derived(
		allModeMapsByColor[playerColor]?.[selectedMode ?? 'all'] ?? null
	);

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

	let hoveredMove = $state<string | null>(null);
	let hoveredSquares = $derived.by((): [string, string] | undefined => {
		if (!hoveredMove) return undefined;
		try {
			const chess = new Chess(boardState.fen);
			const result = chess.move(hoveredMove);
			return [result.from, result.to];
		} catch {
			return undefined;
		}
	});

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
		processedGamesByColor = {};
		selectedMode = null;
		moveHistory = [];
		errorMessage = '';

		const gamesApiPath = platform === 'lichess' ? '/api/games/lichess' : '/api/games/chess-com';
		const profileApiPath = platform === 'lichess' ? '/api/profile/lichess' : '/api/profile/chess-com';
		const encodedUsername = encodeURIComponent(username);

		loading = true;
		loadingElapsed = 0;
		const startTime = Date.now();
		const elapsedTimer = setInterval(() => { loadingElapsed = (Date.now() - startTime) / 1000; }, 100);

		try {
			const makeGamesParams = (color: 'white' | 'black') =>
				new URLSearchParams({ username, color, max: String(maxGames) });

			loadingStatus = 'Fetching games…';
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

			// Profile response is already buffered — parse now so the card appears before game processing.
			if (profileResponse.ok) {
				profile = await profileResponse.json() as Profile;
			}

			const [{ games: whiteGames }, { games: blackGames }] = await Promise.all([
				whiteResponse.json() as Promise<{ games: Game[] }>,
				blackResponse.json() as Promise<{ games: Game[] }>,
			]);

			loadingStatus = 'Building move tree…';
			loadingProgress = 0;
			const total = whiteGames.length + blackGames.length;
			let whiteProcessed = 0;
			let blackProcessed = 0;
			const [white, black] = await Promise.all([
				processGames(whiteGames, (partial) => {
					whiteProcessed = partial.length;
					loadingProgress = Math.round((whiteProcessed + blackProcessed) / total * 100);
					processedGamesByColor = { ...processedGamesByColor, white: partial };
					rebuildMaps(processedGamesByColor);
				}),
				processGames(blackGames, (partial) => {
					blackProcessed = partial.length;
					loadingProgress = Math.round((whiteProcessed + blackProcessed) / total * 100);
					processedGamesByColor = { ...processedGamesByColor, black: partial };
					rebuildMaps(processedGamesByColor);
				}),
			]);
			processedGamesByColor = { white, black };
			rebuildMaps(processedGamesByColor);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			clearInterval(elapsedTimer);
			loading = false;
			loadingStatus = '';
		}
	}

	function resetExplorer(): void {
		_buildSignal.cancelled = true;
		processedGamesByColor = {};
		allModeMapsByColor = {};
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
					class="flex flex-wrap gap-3 mt-2 justify-center"
					onsubmit={(e) => { e.preventDefault(); search(); }}
				>
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

					<!-- Limit + submit joined -->
					<div class="join">
						<select class="join-item select select-bordered select-sm w-36" bind:value={maxGames}>
							<option value={100}>100 games</option>
							<option value={200}>200 games</option>
							<option value={500}>500 games</option>
							<option value={1000}>1 000 games</option>
							<option value={2000}>2 000 games</option>
							<option value={0}>All games</option>
						</select>
						<button class="join-item btn btn-sm btn-primary w-28" type="submit" disabled={loading || !username.trim()}>
							{#if loading}
								<span class="loading loading-spinner loading-xs"></span>
								Loading…
							{:else}
								Analyze
							{/if}
						</button>
					</div>
				</form>

				{#if loading}
					<p class="text-xs text-base-content/50 mt-1">
						{loadingStatus} · {loadingElapsed.toFixed(1)}s
					</p>
				{/if}

				</div>
		</div>

		{#if errorMessage}
			<div class="alert alert-error shadow">
				<span>{errorMessage}</span>
			</div>

			{#if moveHistory.length > 0}
				<p class="text-sm font-mono text-base-content/60 break-all">
					{moveHistory.join(' ')}
				</p>
			{/if}
		{/if}

		<!-- Profile card -->
		{#if profile}
			<div class="card bg-base-100 shadow">
				<div class="card-body py-3 flex-row flex-wrap items-center gap-4">
					<a href={profileUrl} target="_blank" rel="noopener noreferrer" class="font-semibold link link-hover">
						{profile.username}
					</a>
					<div class="flex gap-1">
						<button
							type="button"
							class="badge cursor-pointer {playerColor === 'white' ? 'badge-primary' : 'badge-ghost'}"
							onclick={() => selectColor('white')}
						>
							White
						</button>
						<button
							type="button"
							class="badge cursor-pointer {playerColor === 'black' ? 'badge-primary' : 'badge-ghost'}"
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
		{#if processedGamesByColor[playerColor]}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">

				<!-- Board + navigation -->
				<div class="card bg-base-100 shadow" bind:clientHeight={boardCardHeight}>
					<div class="card-body">
						<Board fen={boardState.fen} {orientation} lastMove={boardState.lastMovedSquares} hoverSquares={hoveredSquares} />
					</div>
				</div>

				<!-- Move list -->
				<div class="card bg-base-100 shadow flex flex-col" style="max-height: {boardCardHeight}px">
					<div class="card-body flex-1 flex flex-col overflow-hidden">
						<div class="flex items-center justify-between mb-1">
							<h2 class="card-title text-base">
								{isPlayerTurn ? 'Your moves from here' : "Opponent's moves from here"}
							</h2>
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
						<div class="flex-1 min-h-0 overflow-y-auto">
							<MoveList
								moves={positionData.moves}
								totalGames={positionData.totalGames}
								onSelect={playMove}
								onHover={(m) => { hoveredMove = m; }}
								updating={loading}
								progress={loadingProgress}
							/>
						</div>
					</div>
				</div>

			</div>

		{#if moveHistory.length > 0}
			<div class="flex flex-wrap items-baseline gap-x-1 gap-y-1 font-mono text-sm text-base-content/70 px-1">
				{#each moveHistory as move, i}
					{#if i % 2 === 0}
						<span class="text-base-content/40 select-none">{Math.floor(i / 2) + 1}.</span>
					{/if}
					<button
						class="hover:text-base-content transition-colors {i === moveHistory.length - 1 ? 'text-base-content font-semibold' : ''}"
						onclick={() => { moveHistory = moveHistory.slice(0, i + 1); }}
					>{move}</button>
				{/each}
			</div>
		{/if}
		{/if}

	</div>
</main>
