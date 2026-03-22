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
			class="grid w-full items-center gap-x-3 font-mono text-sm py-2 px-3 rounded-lg hover:bg-base-200 active:bg-base-300 cursor-pointer"
			style="grid-template-columns: 3rem 3rem 1fr 3rem 3rem 3rem"
			onclick={() => onSelect(move.algebraicNotation)}
		>
			<span class="text-base font-semibold text-left">{move.algebraicNotation}</span>

			<span class="flex flex-col items-end">
				<span class="text-primary/70">{move.count}×</span>
				<span class="text-primary/70 text-xs">({move.percentage}%)</span>
			</span>

			<span class="flex flex-col gap-0.5">
				<!-- Move frequency bar -->
				<span class="h-1.5 w-full rounded-full bg-base-200 overflow-hidden">
					<span
						class="h-full block rounded-full bg-primary/50"
						style="width: {move.percentage}%"
					></span>
				</span>
				<!-- Win / draw / loss bar -->
				<span class="h-1.5 w-full rounded-full overflow-hidden flex">
					<span class="bg-green-600" style="width: {move.winPercentage}%"></span>
					<span class="bg-gray-400" style="width: {move.drawPercentage}%"></span>
					<span class="bg-red-700" style="width: {move.lossPercentage}%"></span>
				</span>
			</span>

			<span class="text-xs text-green-600 tabular-nums">W{move.winPercentage}%</span>
			<span class="text-xs text-gray-400 tabular-nums">D{move.drawPercentage}%</span>
			<span class="text-xs text-red-700 tabular-nums">L{move.lossPercentage}%</span>
		</button>
	{/each}

	{#if moves.length === 0}
		<p class="text-base-content/40 text-sm text-center py-8">
			No moves recorded from this position.
		</p>
	{/if}
</div>
