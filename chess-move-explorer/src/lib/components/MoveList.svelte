<script lang="ts">
	import type { MoveFrequency } from '$lib/chess/move-tree';

	interface Props {
		moves: MoveFrequency[];
		totalGames: number;
		onSelect: (algebraicNotation: string) => void;
	}

	let { moves, totalGames, onSelect }: Props = $props();
</script>

<div class="flex flex-col gap-1">
	<p class="text-sm text-base-content/60 mb-2">
		{totalGames} game{totalGames !== 1 ? 's' : ''} from this position
	</p>

	{#each moves as move}
		<button
			class="btn btn-ghost justify-between w-full font-mono"
			onclick={() => onSelect(move.algebraicNotation)}
		>
			<span class="text-base font-semibold">{move.algebraicNotation}</span>
			<span class="flex items-center gap-3 text-sm">
				<span class="text-base-content/60">{move.count}×</span>
				<span class="w-24">
					<span
						class="block h-2 rounded-full bg-primary"
						style="width: {move.percentage}%"
					></span>
				</span>
				<span class="w-8 text-right">{move.percentage}%</span>
			</span>
		</button>
	{/each}

	{#if moves.length === 0}
		<p class="text-base-content/40 text-sm text-center py-8">
			No moves recorded from this position.
		</p>
	{/if}
</div>
