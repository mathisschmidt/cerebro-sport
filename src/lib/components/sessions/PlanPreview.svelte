<script lang="ts">
	import type { SessionDetail } from '$domain/models/session.ts';
	import { formatClock, formatMeasure } from '$domain/models/common.ts';
	import { buildPlan } from '$domain/services/session-plan.ts';
	import { planStepLabel as label } from '$domain/models/plan.ts';
	import Icon from '$components/ui/Icon.svelte';

	/**
	 * What the session will actually feel like, built with the same `buildPlan`
	 * the runner uses — so the preview can never drift from the real thing.
	 */
	interface Props {
		session: SessionDetail;
		defaultExpanded?: boolean;
	}

	let { session, defaultExpanded = false }: Props = $props();

	const plan = $derived(buildPlan(session));

	// Seeded once: after mount the disclosure belongs to the reader, not the caller.
	// svelte-ignore state_referenced_locally
	let expanded = $state(defaultExpanded);
</script>

<div class="flex flex-col gap-3">
	<div class="flex flex-wrap items-center gap-x-4 gap-y-1">
		<span class="text-ink-muted inline-flex items-center gap-1.5 text-[13px]">
			<Icon name="clock" size={14} />
			<span class="tabular text-ink font-semibold">{formatClock(plan.estimatedDurationSec)}</span>
			estimated
		</span>
		<span class="text-ink-muted inline-flex items-center gap-1.5 text-[13px]">
			<Icon name="layers" size={14} />
			<span class="tabular text-ink font-semibold">{plan.steps.length}</span>
			steps
		</span>
	</div>

	{#if session.blocks.length > 0}
		<ol class="flex flex-col gap-1.5">
			{#each session.blocks as block, blockIndex (block.id)}
				<li class="bg-surface-sunken/60 border-line rounded-lg border px-3 py-2">
					<div class="flex items-baseline gap-2">
						<span class="text-accent shrink-0 text-[11px] font-bold">
							{block.rounds}×
						</span>
						<p class="text-ink-muted min-w-0 flex-1 text-[12px] leading-relaxed">
							{#if block.label}<span class="text-ink font-medium">{block.label}: </span>{/if}
							{#each block.items as item, itemIndex (item.id)}
								<span class="text-ink">{formatMeasure(item.measure)}</span>&nbsp;{item.exercise
									.name}{#if itemIndex < block.items.length - 1}<span class="text-ink-subtle">
										&nbsp;+&nbsp;
									</span>{/if}
							{/each}
						</p>
					</div>
					{#if block.rounds > 1 && block.restBetweenRoundsSec > 0}
						<p class="text-ink-subtle mt-0.5 pl-6 text-[11px]">
							{block.restBetweenRoundsSec}s rest between rounds
						</p>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}

	{#if plan.steps.length > 0}
		<button
			type="button"
			class="text-ink-subtle hover:text-ink inline-flex items-center gap-1 self-start text-[12px] transition-colors"
			onclick={() => (expanded = !expanded)}
			aria-expanded={expanded}
		>
			<Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={13} />
			{expanded ? 'Hide' : 'Show'} the {plan.steps.length}-step timeline
		</button>

		{#if expanded}
			<ol class="border-line flex max-h-72 flex-col overflow-y-auto rounded-lg border">
				{#each plan.steps as step (step.key)}
					<li
						class="border-line flex items-center gap-2.5 border-b px-3 py-1.5 text-[12px] last:border-b-0
						{step.kind === 'rest' ? 'bg-surface-sunken/50' : ''}"
					>
						<span class="text-ink-subtle tabular w-6 shrink-0 text-right text-[10px]">
							{step.index + 1}
						</span>
						<span class="{step.kind === 'rest' ? 'text-info' : 'text-accent'} shrink-0">
							<Icon name={step.kind === 'rest' ? 'timer' : 'zap'} size={13} />
						</span>
						<span class="text-ink min-w-0 flex-1 truncate">{label(step)}</span>
						{#if step.roundCount > 1 && step.kind === 'exercise'}
							<span class="text-ink-subtle shrink-0 text-[10px]">
								R{step.roundIndex}/{step.roundCount}
							</span>
						{/if}
						<span class="text-ink-muted tabular shrink-0 text-[11px]">
							{step.measure ? formatMeasure(step.measure) : `${step.restSec}s`}
						</span>
					</li>
				{/each}
			</ol>
		{/if}
	{/if}
</div>
