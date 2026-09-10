<script lang="ts">
	interface Props {
		/** 0–1. */
		value: number;
		height?: number;
		tone?: 'accent' | 'success' | 'danger';
		class?: string;
		label?: string;
	}

	let { value, height = 6, tone = 'accent', class: className = '', label }: Props = $props();

	const COLORS = {
		accent: 'var(--app-accent)',
		success: 'var(--app-success)',
		danger: 'var(--app-danger)'
	};

	const pct = $derived(Math.min(100, Math.max(0, value * 100)));
</script>

<div
	class="bg-surface-sunken w-full overflow-hidden rounded-full {className}"
	style="height:{height}px"
	role="progressbar"
	aria-valuenow={Math.round(pct)}
	aria-valuemin="0"
	aria-valuemax="100"
	aria-label={label ?? 'Progress'}
>
	<div
		class="h-full rounded-full transition-[width] duration-300 ease-out"
		style="width:{pct}%;background:{COLORS[tone]}"
	></div>
</div>
