<script lang="ts">
	import type { PackPlan } from '$domain/services/pack-resolve.ts';
	import { formatDuration, formatMeasure } from '$domain/models/common.ts';
	import Badge from '$components/ui/Badge.svelte';
	import Icon from '$components/ui/Icon.svelte';

	/**
	 * What the import will actually do, rendered straight from the resolver the
	 * server re-runs — so this preview cannot promise anything the import skips.
	 */
	interface Props {
		plan: PackPlan;
		skipped: string[];
		ontoggle: (sessionName: string) => void;
		/** Session names in the pack, including ones currently skipped. */
		allSessionNames: string[];
	}

	let { plan, skipped, ontoggle, allSessionNames }: Props = $props();

	const newExercises = $derived(plan.exercises.filter((entry) => entry.existingId === null));
	const reused = $derived(plan.exercises.filter((entry) => entry.existingId !== null));
	const errors = $derived(plan.issues.filter((issue) => issue.level === 'error'));
	const warnings = $derived(plan.issues.filter((issue) => issue.level === 'warning'));

	let expanded = $state<string | null>(null);
</script>

<div class="flex flex-col gap-3">
	{#if plan.summary}
		<p class="text-ink-muted border-line border-l-2 pl-3 text-[13px] leading-relaxed italic">
			{plan.summary}
		</p>
	{/if}

	{#if errors.length > 0}
		<div class="border-danger/40 bg-danger/8 rounded-xl border p-3">
			<p class="text-danger mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold">
				<Icon name="alert" size={14} />
				{errors.length} problem{errors.length > 1 ? 's' : ''} to fix
			</p>
			<ul class="flex flex-col gap-1">
				{#each errors as issue (issue.path + issue.message)}
					<li class="text-ink-muted text-[12px]">
						<code class="text-ink-subtle">{issue.path}</code> — {issue.message}
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if warnings.length > 0}
		<div class="border-warning/35 bg-warning/8 rounded-xl border p-3">
			<ul class="flex flex-col gap-1">
				{#each warnings as issue (issue.path + issue.message)}
					<li class="text-ink-muted flex items-start gap-1.5 text-[12px]">
						<span class="text-warning mt-0.5 shrink-0"><Icon name="alert" size={12} /></span>
						{issue.message}
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Sessions -->
	{#if allSessionNames.length > 0}
		<section>
			<h4 class="text-ink-subtle mb-1.5 text-[11px] font-medium tracking-wide uppercase">
				Sessions ({plan.sessions.length} of {allSessionNames.length} selected)
			</h4>
			<ul class="flex flex-col gap-1.5">
				{#each allSessionNames as name (name)}
					{@const entry = plan.sessions.find((session) => session.originalName === name)}
					<li class="border-line rounded-xl border">
						<div class="flex items-center gap-2.5 p-2.5">
							<input
								type="checkbox"
								class="accent-accent size-4 shrink-0 rounded"
								checked={!skipped.includes(name)}
								onchange={() => ontoggle(name)}
								aria-label="Import {name}"
							/>
							<button
								type="button"
								class="min-w-0 flex-1 text-left"
								onclick={() => (expanded = expanded === name ? null : name)}
								aria-expanded={expanded === name}
								disabled={!entry}
							>
								<div class="flex flex-wrap items-center gap-1.5">
									<span class="text-ink text-[13px] font-medium">{entry?.name ?? name}</span>
									{#if entry?.renamed}
										<Badge tone="warning">renamed from "{entry.originalName}"</Badge>
									{/if}
								</div>
								{#if entry}
									<p class="text-ink-subtle mt-0.5 flex flex-wrap gap-x-3 text-[11px]">
										<span>{entry.blockCount} block{entry.blockCount > 1 ? 's' : ''}</span>
										<span>{entry.exerciseCount} sets</span>
										<span>{formatDuration(entry.estimatedDurationSec * 1000)}</span>
									</p>
								{:else}
									<p class="text-ink-subtle mt-0.5 text-[11px]">Skipped</p>
								{/if}
							</button>
							{#if entry}
								<span class="text-ink-subtle shrink-0">
									<Icon name={expanded === name ? 'chevronUp' : 'chevronDown'} size={15} />
								</span>
							{/if}
						</div>

						{#if expanded === name && entry}
							<ol class="border-line flex flex-col gap-1 border-t p-2.5">
								{#each entry.source.blocks as block, blockIndex (blockIndex)}
									<li class="bg-surface-sunken/60 rounded-lg px-2.5 py-1.5">
										<div class="flex items-baseline gap-2">
											<span class="text-accent shrink-0 text-[11px] font-bold">{block.rounds}×</span>
											<p class="text-ink-muted min-w-0 flex-1 text-[12px] leading-relaxed">
												{#if block.label}<span class="text-ink font-medium">{block.label}: </span>{/if}
												{#each block.items as item, itemIndex (itemIndex)}<span class="text-ink"
														>{formatMeasure(item.measure)}</span
													>&nbsp;{item.exercise}{#if itemIndex < block.items.length - 1}<span
															class="text-ink-subtle">&nbsp;+&nbsp;</span
														>{/if}{/each}
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
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- Exercises -->
	<section class="grid gap-3 sm:grid-cols-2">
		<div>
			<h4 class="text-ink-subtle mb-1.5 text-[11px] font-medium tracking-wide uppercase">
				New exercises ({newExercises.length})
			</h4>
			{#if newExercises.length === 0}
				<p class="text-ink-subtle text-[12px]">None — everything already exists.</p>
			{:else}
				<ul class="flex flex-wrap gap-1.5">
					{#each newExercises as entry (entry.name)}
						<Badge tone={entry.status === 'stub' ? 'warning' : 'accent'}>
							{entry.name}{entry.status === 'stub' ? ' · no description' : ''}
						</Badge>
					{/each}
				</ul>
			{/if}
		</div>

		<div>
			<h4 class="text-ink-subtle mb-1.5 text-[11px] font-medium tracking-wide uppercase">
				Reused from your library ({reused.length})
			</h4>
			{#if reused.length === 0}
				<p class="text-ink-subtle text-[12px]">None.</p>
			{:else}
				<ul class="flex flex-wrap gap-1.5">
					{#each reused as entry (entry.name)}
						<Badge>{entry.name}</Badge>
					{/each}
				</ul>
			{/if}
		</div>
	</section>

	<!-- Routines -->
	{#if plan.routines.length > 0}
		<section>
			<h4 class="text-ink-subtle mb-1.5 text-[11px] font-medium tracking-wide uppercase">
				Routines ({plan.routines.length})
			</h4>
			<ul class="flex flex-col gap-1">
				{#each plan.routines as routine (routine.name + routine.sessionName)}
					<li class="text-ink-muted flex flex-wrap items-center gap-x-2 text-[12px]">
						<span class="text-accent shrink-0"><Icon name="repeat" size={12} /></span>
						<span class="text-ink font-medium">{routine.name}</span>
						<span>— {routine.recurrenceLabel}</span>
						{#if routine.timeOfDay}<span>at {routine.timeOfDay}</span>{/if}
						{#if routine.target === 'missing'}
							<Badge tone="danger">session not found</Badge>
						{:else if routine.target === 'library'}
							<Badge>existing session</Badge>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
