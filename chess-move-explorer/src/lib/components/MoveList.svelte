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
			class="btn btn-ghost w-full justify-between font-mono h-auto py-2"
			onclick={() => onSelect(move.algebraicNotation)}
		>
			<span class="text-base font-semibold w-10 text-left">{move.algebraicNotation}</span>

			<span class="flex flex-1 items-center gap-3 text-sm min-w-0">
				<span class="flex flex-col items-end shrink-0 w-12">
					<span class="text-primary/70">{move.count}×</span>
					<span class="text-primary/70 text-xs">({move.percentage}%)</span>
				</span>

				<span class="flex flex-col gap-0.5 flex-1 min-w-0">
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

				<span class="text-xs shrink-0 flex gap-1 tabular-nums">
					<span class="text-green-600 w-10 text-right">W{move.winPercentage}%</span>
					<span class="text-gray-400 w-10 text-right">D{move.drawPercentage}%</span>
					<span class="text-red-700 w-10 text-right">L{move.lossPercentage}%</span>
				</span>
			</span>
		</button>
	{/each}

	{#if moves.length === 0}
		<p class="text-base-content/40 text-sm text-center py-8">
			No moves recorded from this position.
		</p>
	{/if}
</div>
