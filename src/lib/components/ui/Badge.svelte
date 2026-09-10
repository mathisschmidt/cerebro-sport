<script lang="ts" module>
	export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		tone?: BadgeTone;
		class?: string;
		children: Snippet;
	}

	let { tone = 'neutral', class: className = '', children }: Props = $props();

	const TONES: Record<BadgeTone, string> = {
		neutral: 'bg-surface-sunken text-ink-muted border-line',
		accent: 'bg-accent-soft text-accent border-accent/30',
		success: 'bg-success/12 text-success border-success/30',
		warning: 'bg-warning/12 text-warning border-warning/30',
		danger: 'bg-danger/12 text-danger border-danger/30',
		info: 'bg-info/12 text-info border-info/30'
	};
</script>

<span
	class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap {TONES[
		tone
	]} {className}"
>
	{@render children()}
</span>
