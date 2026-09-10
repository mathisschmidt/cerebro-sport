<script lang="ts">
	import type { StepProgress } from '$domain/models/metrics.ts';
	import { formatDuration, formatMeasure } from '$domain/models/common.ts';
	import Sparkline from '$components/charts/Sparkline.svelte';
	import TrendPill from '$components/charts/TrendPill.svelte';

	/**
	 * Per-step history — the answer to "am I getting faster on *this* part?".
	 * A table rather than a chart: eight to forty steps is far past what a plot
	 * can label, and the numbers are the point.
	 */
	interface Props {
		steps: StepProgress[];
	}

	let { steps }: Props = $props();

	const grouped = $derived.by(() => {
		const groups = new Map<string, { label: string; steps: StepProgress[] }>();
		for (const step of steps) {
			const key = `${step.blockIndex}:${step.blockLabel}`;
			const group = groups.get(key);
			if (group) group.steps.push(step);
			else groups.set(key, { label: step.blockLabel, steps: [step] });
		}
		return [...groups.values()];
	});
</script>

{#if steps.length === 0}
	<p class="text-ink-subtle py-6 text-center text-[13px]">
		Run this session at least once to see per-step progress.
	</p>
{:else}
	<div class="flex flex-col gap-4">
		{#each grouped as group (group.label)}
			<div>
				<h4 class="text-ink-subtle mb-1.5 text-[11px] font-medium tracking-wide uppercase">
					{group.label}
				</h4>

				<!-- Tables are the one thing allowed to scroll sideways on a phone -->
				<div class="border-line overflow-x-auto rounded-xl border">
					<table class="w-full min-w-[34rem] border-collapse text-left">
						<thead>
							<tr class="text-ink-subtle border-line border-b text-[11px]">
								<th class="px-3 py-2 font-medium">Step</th>
								<th class="px-2 py-2 text-right font-medium">Last</th>
								<th class="px-2 py-2 text-right font-medium">Best</th>
								<th class="px-2 py-2 text-right font-medium">Average</th>
								<th class="px-2 py-2 font-medium">Trend</th>
								<th class="px-3 py-2 font-medium">History</th>
							</tr>
						</thead>
						<tbody>
							{#each group.steps as step (step.stepKey)}
								<tr class="border-line border-b text-[12px] last:border-b-0">
									<td class="px-3 py-2">
										<span class="text-ink font-medium">{step.label}</span>
										<span class="text-ink-subtle ml-1.5">
											{#if step.roundCount > 1}R{step.roundIndex}{/if}
											{#if step.measure}· {formatMeasure(step.measure)}{/if}
										</span>
									</td>
									<td class="text-ink tabular px-2 py-2 text-right font-medium">
										{formatDuration(step.latestMs)}
									</td>
									<td class="text-ink-muted tabular px-2 py-2 text-right">
										{formatDuration(step.bestMs)}
									</td>
									<td class="text-ink-muted tabular px-2 py-2 text-right">
										{formatDuration(step.averageMs)}
									</td>
									<td class="px-2 py-2">
										<TrendPill trend={step.trend} deltaPct={step.deltaPct} />
									</td>
									<td class="px-3 py-1.5">
										<Sparkline
											values={step.samples.map((sample) => sample.durationMs)}
											label="{step.label} over {step.samples.length} runs"
										/>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/each}
	</div>
{/if}
