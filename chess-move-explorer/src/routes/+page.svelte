<script lang="ts">
	import { tick } from 'svelte';
	import { Chess } from 'chess.js';
	import Board from '$lib/components/Board.svelte';
	import MoveList from '$lib/components/MoveList.svelte';
	import MoveLog from '$lib/components/MoveLog.svelte';
	import SearchForm from '$lib/components/SearchForm.svelte';
	import ProfileCard from '$lib/components/ProfileCard.svelte';
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
	import { Platform, PlayerColor, type Profile } from '$lib/types';

	// --- Form state ---
	let username = $state('');
	let platform = $state<Platform>(Platform.ChessCom);
	let playerColor = $state<PlayerColor>(PlayerColor.White);
	let maxGames = $state(500); // 0 = all games
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
	let processedGamesByColor = $state<Partial<Record<PlayerColor, ProcessedGame[]>>>({});

	// --- Pre-computed maps for every mode per color; rebuilt async to avoid blocking the main thread ---
	let allModeMapsByColor = $state<Partial<Record<PlayerColor, Record<string, FrequencyMaps>>>>({});
	let _buildSignal: BuildSignal = { cancelled: false };

	async function rebuildMaps(games: Partial<Record<PlayerColor, ProcessedGame[]>>) {
		_buildSignal.cancelled = true;
		const signal = (_buildSignal = { cancelled: false });
		const result: typeof allModeMapsByColor = {};
		for (const color of [PlayerColor.White, PlayerColor.Black]) {
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
	let moveLogEl = $state<HTMLElement | null>(null);

	// --- Derived board state ---
	let boardState = $derived.by(() => {
		const chessInstance = new Chess();
		const seenFens = new Set([normalizeFenForLookup(chessInstance.fen())]);
		let lastMovedSquares: [string, string] | undefined;
		for (const moveNotation of moveHistory) {
			const moveResult = chessInstance.move(moveNotation);
			if (moveResult) lastMovedSquares = [moveResult.from, moveResult.to];
			seenFens.add(normalizeFenForLookup(chessInstance.fen()));
		}
		const sideToMove: PlayerColor = chessInstance.turn() === 'w' ? PlayerColor.White : PlayerColor.Black;
		return { fen: chessInstance.fen(), lastMovedSquares, sideToMove, seenFens };
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

	// Moves that lead back to a position already in the current line.
	let repeatedMoves = $derived.by(() => {
		const chess = new Chess(boardState.fen);
		const repeated = new Set<string>();
		for (const { algebraicNotation } of positionData.moves) {
			try {
				chess.move(algebraicNotation);
				if (boardState.seenFens.has(normalizeFenForLookup(chess.fen()))) {
					repeated.add(algebraicNotation);
				}
				chess.undo();
			} catch { /* skip invalid */ }
		}
		return repeated;
	});

	let profileUrl = $derived(
		profile
			? platform === Platform.Lichess
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

		const gamesApiPath = platform === Platform.Lichess ? '/api/games/lichess' : '/api/games/chess-com';
		const profileApiPath = platform === Platform.Lichess ? '/api/profile/lichess' : '/api/profile/chess-com';
		const encodedUsername = encodeURIComponent(username);

		loading = true;
		loadingElapsed = 0;
		const startTime = Date.now();
		const elapsedTimer = setInterval(() => { loadingElapsed = (Date.now() - startTime) / 1000; }, 100);

		try {
			const makeGamesParams = (color: PlayerColor) =>
				new URLSearchParams({ username, color, max: String(maxGames) });

			loadingStatus = 'Fetching games…';
			const [whiteResponse, blackResponse, profileResponse] = await Promise.all([
				fetch(`${gamesApiPath}?${makeGamesParams(PlayerColor.White)}`),
				fetch(`${gamesApiPath}?${makeGamesParams(PlayerColor.Black)}`),
				fetch(`${profileApiPath}?username=${encodedUsername}`),
			]);

			const primaryResponse = playerColor === PlayerColor.White ? whiteResponse : blackResponse;
			if (!primaryResponse.ok) {
				const body = await primaryResponse.json().catch(() => ({})) as { message?: string };
				throw new Error(body.message ?? `Error ${primaryResponse.status}`);
			}

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

	function selectColor(color: PlayerColor): void {
		if (playerColor === color) return;
		playerColor = color;
		moveHistory = [];
		selectedMode = null;
	}

	async function playMove(algebraicNotation: string): Promise<void> {
		moveHistory = [...moveHistory, algebraicNotation];
		hoveredMove = null;
		await tick();
		if (moveLogEl) moveLogEl.scrollTop = moveLogEl.scrollHeight;
		hoveredMove = document.querySelector('[data-move]:hover')?.getAttribute('data-move') ?? null;
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

		<SearchForm
			bind:platform
			bind:username
			bind:maxGames
			{loading}
			{loadingStatus}
			{loadingElapsed}
			onSearch={search}
			onPlatformChange={resetExplorer}
		/>

		{#if errorMessage}
			<div class="alert alert-error shadow">
				<span>{errorMessage}</span>
			</div>
		{/if}

		{#if profile}
			<ProfileCard
				{profile}
				{profileUrl}
				{playerColor}
				{selectedMode}
				onSelectColor={selectColor}
				onSelectMode={selectMode}
			/>
		{/if}

		{#if processedGamesByColor[playerColor]}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">

				<div class="card bg-base-100 shadow" bind:clientHeight={boardCardHeight}>
					<div class="card-body">
						<Board
							fen={boardState.fen}
							orientation={playerColor}
							lastMove={boardState.lastMovedSquares}
							hoverSquares={hoveredSquares}
						/>
					</div>
				</div>

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
								{repeatedMoves}
							/>
						</div>
						<MoveLog
							{moveHistory}
							bind:el={moveLogEl}
							onJump={(i) => { moveHistory = moveHistory.slice(0, i + 1); }}
						/>
					</div>
				</div>

			</div>
		{/if}

	</div>
</main>
