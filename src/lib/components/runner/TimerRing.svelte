<script lang="ts">
	import { formatClock } from '$domain/models/common.ts';

	/**
	 * Countdown ring. The number is the interface — it is sized to be readable
	 * from the floor, at arm's length, mid-effort.
	 */
	interface Props {
		/** 0–1. */
		progress: number;
		remainingMs: number;
		tone?: 'accent' | 'info';
		/** Below this many seconds the ring switches to the warning colour. */
		warnAt?: number;
		label?: string;
	}

	let { progress, remainingMs, tone = 'accent', warnAt = 5, label }: Props = $props();

	const SIZE = 240;
	const STROKE = 10;
	const RADIUS = (SIZE - STROKE) / 2;
	const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

	const seconds = $derived(Math.ceil(remainingMs / 1000));
	const urgent = $derived(seconds <= warnAt && seconds > 0);
	const color = $derived(
		urgent ? 'var(--app-warning)' : tone === 'info' ? 'var(--app-info)' : 'var(--app-accent)'
	);
	const offset = $derived(CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, progress))));
</script>

<div class="relative mx-auto aspect-square w-full max-w-[min(72vw,240px)]">
	<svg viewBox="0 0 {SIZE} {SIZE}" class="size-full -rotate-90">
		<circle
			cx={SIZE / 2}
			cy={SIZE / 2}
			r={RADIUS}
			fill="none"
			stroke="var(--app-surface-sunken)"
			stroke-width={STROKE}
		/>
		<circle
			cx={SIZE / 2}
			cy={SIZE / 2}
			r={RADIUS}
			fill="none"
			stroke={color}
			stroke-width={STROKE}
			stroke-linecap="round"
			stroke-dasharray={CIRCUMFERENCE}
			stroke-dashoffset={offset}
			style="transition:stroke-dashoffset 100ms linear, stroke 200ms ease"
		/>
	</svg>

	<div class="absolute inset-0 flex flex-col items-center justify-center gap-1">
		{#if label}
			<span class="text-ink-subtle text-[11px] font-medium tracking-wide uppercase">{label}</span>
		{/if}
		<span
			class="text-[clamp(2.75rem,14vw,4rem)] leading-none font-semibold tracking-tight tabular-nums transition-colors"
			style="color:{urgent ? 'var(--app-warning)' : 'var(--app-text)'}"
		>
			{formatClock(seconds)}
		</span>
	</div>
</div>
