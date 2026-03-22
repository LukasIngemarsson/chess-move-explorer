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
				<span class="text-base-content/60 w-10 text-right shrink-0">{move.count}×</span>

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
						<span class="bg-base-300" style="width: {move.drawPercentage}%"></span>
						<span class="bg-red-800" style="width: {move.lossPercentage}%"></span>
					</span>
				</span>

				<span class="text-xs text-base-content/50 w-20 text-right shrink-0">
					W{move.winPercentage}% L{move.lossPercentage}%
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
