<script lang="ts">
	import { formatClock } from '$domain/models/common.ts';
	import NumberStepper from '$components/ui/NumberStepper.svelte';

	/** Rest in seconds, with the presets people actually use. */
	interface Props {
		seconds: number;
		presets?: number[];
		id?: string;
	}

	let { seconds = $bindable(), presets = [0, 15, 30, 60, 90], id }: Props = $props();
</script>

<div class="flex flex-wrap items-center gap-2">
	<NumberStepper
		{id}
		bind:value={seconds}
		min={0}
		max={3600}
		step={5}
		suffix="s"
		ariaLabel="Rest in seconds"
		class="w-36"
	/>
	<div class="flex flex-wrap gap-1">
		{#each presets as preset (preset)}
			<button
				type="button"
				class="h-7 rounded-lg border px-2 text-[11px] font-medium transition-colors
				{seconds === preset
					? 'border-accent bg-accent-soft text-accent'
					: 'border-line text-ink-muted hover:border-line-strong hover:text-ink'}"
				onclick={() => (seconds = preset)}
			>
				{preset === 0 ? 'None' : formatClock(preset)}
			</button>
		{/each}
	</div>
</div>
