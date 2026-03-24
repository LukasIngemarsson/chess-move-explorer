<script lang="ts">
	import type { Platform } from '$lib/types';

	interface Props {
		platform: Platform;
		username: string;
		maxGames: number;
		loading: boolean;
		loadingStatus: string;
		loadingElapsed: number;
		onSearch: () => void;
		onPlatformChange: () => void;
	}

	let {
		platform = $bindable(),
		username = $bindable(),
		maxGames = $bindable(),
		loading,
		loadingStatus,
		loadingElapsed,
		onSearch,
		onPlatformChange,
	}: Props = $props();
</script>

<div class="card bg-base-100 shadow">
	<div class="card-body items-center text-center">
		<h1 class="card-title text-2xl">Chess Move Explorer</h1>
		<p class="text-base-content/60 text-sm">
			Analyze your move tendencies by position across your games.
		</p>

		<form
			class="flex flex-wrap gap-3 mt-2 justify-center"
			onsubmit={(e) => { e.preventDefault(); onSearch(); }}
		>
			<div class="join">
				<button
					type="button"
					class="join-item btn btn-sm {platform === 'lichess' ? 'btn-primary' : ''}"
					onclick={() => { platform = 'lichess'; onPlatformChange(); }}
				>
					Lichess
				</button>
				<button
					type="button"
					class="join-item btn btn-sm {platform === 'chess-com' ? 'btn-primary' : ''}"
					onclick={() => { platform = 'chess-com'; onPlatformChange(); }}
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
