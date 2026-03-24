<script lang="ts">
	interface Props {
		moveHistory: string[];
		el?: HTMLElement | null;
		onJump: (index: number) => void;
	}

	let { moveHistory, el = $bindable(null), onJump }: Props = $props();
</script>

{#if moveHistory.length > 0}
	<div
		bind:this={el}
		class="flex flex-wrap items-baseline gap-x-1 gap-y-1 font-mono text-sm text-base-content/70 pt-2 border-t border-base-200 max-h-20 overflow-y-auto"
	>
		{#each moveHistory as move, i}
			{#if i % 2 === 0}
				<span class="text-base-content/40 select-none">{Math.floor(i / 2) + 1}.</span>
			{/if}
			<button
				class="hover:text-base-content transition-colors {i === moveHistory.length - 1 ? 'text-base-content font-semibold' : ''}"
				onclick={() => onJump(i)}
			>{move}</button>
		{/each}
	</div>
{/if}
