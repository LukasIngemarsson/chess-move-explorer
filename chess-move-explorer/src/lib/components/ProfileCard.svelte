<script lang="ts">
	import { PlayerColor } from '$lib/types';
	import type { Profile } from '$lib/types';
	import ToggleGroup from './ToggleGroup.svelte';

	const colorOptions = [
		{ value: PlayerColor.White, label: 'White' },
		{ value: PlayerColor.Black, label: 'Black' },
	];

	interface Props {
		profile: Profile;
		profileUrl: string | null;
		playerColor: PlayerColor;
		selectedMode: string | null;
		onSelectColor: (color: PlayerColor) => void;
		onSelectMode: (mode: string) => void;
	}

	let { profile, profileUrl, playerColor, selectedMode, onSelectColor, onSelectMode }: Props = $props();
</script>

<div class="card bg-base-100 shadow">
	<div class="card-body py-3 flex-row flex-wrap items-center gap-4">
		<a href={profileUrl} target="_blank" rel="noopener noreferrer" class="font-semibold link link-hover">
			{profile.username}
		</a>
		<ToggleGroup options={colorOptions} value={playerColor} onChange={(v) => onSelectColor(v as PlayerColor)} />
		<div class="flex flex-wrap gap-2">
			{#each profile.ratings as { mode, rating }}
				{#if rating !== null}
					<button
						type="button"
						class="badge gap-1 cursor-pointer {selectedMode === mode ? 'badge-primary' : 'badge-ghost'}"
						onclick={() => onSelectMode(mode)}
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
