<script lang="ts">
	// $state — reactive variable (React: useState)
	let count = $state(0);
	let name = $state('world');

	// $derived — computed value (React: useMemo)
	let doubled = $derived(count * 2);

	function increment(): void {
		count += 1;
	}

	function reset(): void {
		count = 0;
	}
</script>

<main class="max-w-xl mx-auto mt-12 px-4 space-y-6">

	<!-- Card: two-way binding demo -->
	<div class="card bg-base-100 shadow">
		<div class="card-body">
			<h2 class="card-title">Hello, {name}!</h2>
			<p class="text-base-content/60">Type below to update the title in real time.</p>
			<!-- bind:value is two-way binding — React: value={name} + onChange -->
			<input
				bind:value={name}
				placeholder="Enter your name"
				class="input input-bordered w-full"
			/>
		</div>
	</div>

	<!-- Card: counter demo -->
	<div class="card bg-base-100 shadow">
		<div class="card-body">
			<h2 class="card-title">Counter</h2>
			<p class="text-base-content/60">Count: {count} — Doubled: {doubled}</p>
			<div class="card-actions">
				<button class="btn btn-primary" onclick={increment}>Increment</button>
				<button class="btn btn-outline" onclick={reset}>Reset</button>
			</div>
		</div>
	</div>

	<!-- Card: conditional + list rendering -->
	<div class="card bg-base-100 shadow">
		<div class="card-body space-y-3">
			<h2 class="card-title">Svelte template syntax</h2>

			<!-- {#if} — React: ternary or && -->
			{#if count > 5}
				<div class="alert alert-success">Count is getting high!</div>
			{:else if count > 0}
				<div class="alert">Just started counting.</div>
			{:else}
				<div class="alert alert-info">Hit increment to start.</div>
			{/if}

			<!-- {#each} — React: .map() -->
			<ul class="list-disc list-inside text-sm space-y-1">
				{#each ['Svelte', 'SvelteKit', 'Tailwind', 'DaisyUI', 'Supabase'] as item}
					<li>{item}</li>
				{/each}
			</ul>
		</div>
	</div>

	<!-- Button variants showcase -->
	<div class="card bg-base-100 shadow">
		<div class="card-body">
			<h2 class="card-title">Button variants</h2>
			<p class="text-base-content/60">DaisyUI ships these out of the box.</p>
			<div class="card-actions flex-wrap">
				<button class="btn">Default</button>
				<button class="btn btn-primary">Primary</button>
				<button class="btn btn-secondary">Secondary</button>
				<button class="btn btn-accent">Accent</button>
				<button class="btn btn-outline">Outline</button>
				<button class="btn btn-ghost">Ghost</button>
				<button class="btn btn-error">Error</button>
			</div>
		</div>
	</div>

</main>
