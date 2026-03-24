<script lang="ts">
	interface Option {
		value: string;
		label: string;
	}

	interface Props {
		options: Option[];
		value: string;
		variant?: 'badge' | 'btn';
		onChange?: (newValue: string) => void;
	}

	let { options, value = $bindable(), variant = 'badge', onChange }: Props = $props();

	function select(newValue: string) {
		if (value === newValue) return;
		value = newValue;
		onChange?.(newValue);
	}
</script>

{#if variant === 'btn'}
	<div class="join">
		{#each options as option}
			<button
				type="button"
				class="join-item btn btn-sm {value === option.value ? 'btn-primary' : ''}"
				onclick={() => select(option.value)}
			>
				{option.label}
			</button>
		{/each}
	</div>
{:else}
	<div class="flex gap-1">
		{#each options as option}
			<button
				type="button"
				class="badge cursor-pointer {value === option.value ? 'badge-primary' : 'badge-ghost'}"
				onclick={() => select(option.value)}
			>
				{option.label}
			</button>
		{/each}
	</div>
{/if}
