<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { ImportResult } from '$domain/models/pack.ts';
	import { issuesAsFeedback, readPack } from '$domain/services/pack-parse.ts';
	import { resolvePack } from '$domain/services/pack-resolve.ts';
	import { api, ApiError } from '$client/api.ts';
	import { toasts } from '$client/toast.svelte.ts';
	import Badge from '$components/ui/Badge.svelte';
	import Button from '$components/ui/Button.svelte';
	import CopyButton from '$components/ui/CopyButton.svelte';
	import Icon from '$components/ui/Icon.svelte';
	import TextArea from '$components/ui/TextArea.svelte';
	import PackPreview from './PackPreview.svelte';

	/**
	 * Takes a training pack from wherever it came from — a file an agent wrote, a
	 * drag-and-drop, or a reply pasted out of a chat window — and imports it.
	 *
	 * Self-contained on purpose: the guided prompt flow ends here, and someone
	 * who already has a file starts here, with no other steps in the way.
	 */
	interface Props {
		exercises: Array<{ id: string; name: string }>;
		sessions: Array<{ id: string; name: string }>;
		today: string;
		title?: string;
		/** Shown as a numbered badge when this is the last leg of the guided flow. */
		step?: number | null;
		hint?: string;
		/** Bindable so switching Coach modes does not discard a pasted pack. */
		raw?: string;
	}

	let {
		exercises,
		sessions,
		today,
		title = 'Import a training pack',
		step = null,
		hint = '',
		raw = $bindable('')
	}: Props = $props();

	/** A pack is a few kilobytes; anything this size is not one. */
	const MAX_FILE_BYTES = 2_000_000;

	let fileName = $state('');
	let skipped = $state<string[]>([]);
	let importing = $state(false);
	let dragging = $state(false);
	let result = $state<ImportResult | null>(null);
	let fileInput: HTMLInputElement | null = $state(null);

	// Parsing is pure and cheap, so the preview just follows the text.
	const read = $derived(raw.trim().length > 0 ? readPack(raw) : null);

	const plan = $derived(
		read?.ok
			? resolvePack(read.pack, {
					existingExercises: exercises,
					existingSessions: sessions,
					today,
					options: { skipSessions: skipped, skipRoutines: [], includeRoutines: true }
				})
			: null
	);

	const allSessionNames = $derived(read?.ok ? read.pack.sessions.map((s) => s.name) : []);
	const parseIssues = $derived(read && !read.ok ? read.issues : []);

	async function loadFile(file: File) {
		if (file.size > MAX_FILE_BYTES) {
			toasts.error('That file is far too big to be a training pack');
			return;
		}
		try {
			raw = await file.text();
			fileName = file.name;
			result = null;
			skipped = [];
		} catch {
			toasts.error('Could not read that file');
		}
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		dragging = false;
		const file = event.dataTransfer?.files?.[0];
		if (file) void loadFile(file);
	}

	function onPick(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) void loadFile(file);
		// Reset so picking the same file twice still fires a change.
		input.value = '';
	}

	function clear() {
		raw = '';
		fileName = '';
		skipped = [];
		result = null;
	}

	function toggleSession(name: string) {
		skipped = skipped.includes(name) ? skipped.filter((s) => s !== name) : [...skipped, name];
	}

	async function runImport() {
		if (!read?.ok || !plan?.importable) return;
		importing = true;
		try {
			result = await api.packs.import(read.pack, {
				skipSessions: skipped,
				skipRoutines: [],
				includeRoutines: true
			});
			toasts.success('Imported');
			raw = '';
			fileName = '';
			skipped = [];
			await invalidateAll();
		} catch (error) {
			toasts.error(error instanceof ApiError ? error.message : 'Could not import that pack');
		} finally {
			importing = false;
		}
	}
</script>

<!--
	Without this, a file dropped anywhere but the zone makes the browser navigate
	to it — losing whatever was already typed on the page.
-->
<svelte:window
	ondragover={(event) => event.preventDefault()}
	ondrop={(event) => event.preventDefault()}
/>

<div class="card p-4 sm:p-5">
	<div class="mb-3 flex flex-wrap items-center gap-2.5">
		{#if step !== null}
			<span
				class="grid size-6 shrink-0 place-items-center rounded-lg text-[12px] font-bold {read?.ok
					? 'bg-accent text-accent-ink'
					: 'bg-surface-sunken text-ink-subtle'}"
			>
				{step}
			</span>
		{/if}
		<h2 class="text-ink text-[15px] font-semibold">{title}</h2>
		{#if read?.ok}
			<Badge tone="success">Valid pack</Badge>
		{:else if parseIssues.length > 0}
			<Badge tone="danger">{parseIssues.length} problem{parseIssues.length > 1 ? 's' : ''}</Badge>
		{/if}
		{#if fileName}
			<Badge><Icon name="file" size={11} />{fileName}</Badge>
		{/if}
	</div>

	{#if hint}
		<p class="text-ink-subtle mb-3 text-[12px] leading-relaxed">{hint}</p>
	{/if}

	<!-- File first: an agent writes a file, and dropping it is fewer steps than
	     opening it, selecting all and copying. -->
	<div
		class="rounded-xl border border-dashed transition-colors {dragging
			? 'border-accent bg-accent-soft'
			: 'border-line'}"
		ondragover={(event) => {
			event.preventDefault();
			dragging = true;
		}}
		ondragleave={() => (dragging = false)}
		ondrop={onDrop}
		role="region"
		aria-label="Drop a training pack file"
	>
		<div class="flex flex-wrap items-center justify-center gap-2 px-4 py-4 text-center">
			<span class="text-ink-subtle"><Icon name="upload" size={18} /></span>
			<p class="text-ink-muted text-[13px]">
				{dragging ? 'Drop it here' : 'Drop a .json file here, or'}
			</p>
			{#if !dragging}
				<Button variant="secondary" size="sm" icon="file" onclick={() => fileInput?.click()}>
					Choose a file
				</Button>
			{/if}
		</div>
		<input
			bind:this={fileInput}
			type="file"
			accept=".json,.txt,.md,application/json,text/plain,text/markdown"
			class="hidden"
			onchange={onPick}
		/>
	</div>

	<div class="my-3 flex items-center gap-3">
		<span class="bg-line h-px flex-1"></span>
		<span class="text-ink-subtle text-[11px]">or paste it</span>
		<span class="bg-line h-px flex-1"></span>
	</div>

	<TextArea
		bind:value={raw}
		rows={6}
		placeholder={'Paste the JSON here — the ```json block, or the whole reply.'}
		class="font-mono !text-[11px]"
		invalid={parseIssues.length > 0}
		oninput={() => {
			fileName = '';
			result = null;
		}}
	/>

	{#if parseIssues.length > 0}
		<div class="border-danger/40 bg-danger/8 mt-3 rounded-xl border p-3">
			<p class="text-danger mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold">
				<Icon name="alert" size={14} />
				That did not validate
			</p>
			<ul class="mb-3 flex flex-col gap-1">
				{#each parseIssues.slice(0, 8) as issue (issue.path + issue.message)}
					<li class="text-ink-muted text-[12px]">
						<code class="text-ink-subtle">{issue.path}</code> — {issue.message}
					</li>
				{/each}
				{#if parseIssues.length > 8}
					<li class="text-ink-subtle text-[12px]">…and {parseIssues.length - 8} more</li>
				{/if}
			</ul>
			<!-- Fastest fix is to let whatever wrote it correct its own output -->
			<CopyButton
				text={issuesAsFeedback(parseIssues)}
				size="sm"
				label="Copy these errors for the AI"
				copiedLabel="Copied — paste it back in the chat"
			/>
		</div>
	{/if}

	{#if plan}
		<div class="border-line mt-4 border-t pt-4">
			<PackPreview {plan} {skipped} {allSessionNames} ontoggle={toggleSession} />

			<div class="mt-4 flex flex-wrap items-center justify-end gap-2">
				<Button variant="ghost" onclick={clear}>Clear</Button>
				<Button
					variant="primary"
					icon="check"
					loading={importing}
					disabled={!plan.importable || plan.sessions.length + plan.exercises.length === 0}
					onclick={runImport}
				>
					Import
				</Button>
			</div>
		</div>
	{/if}

	{#if result}
		<div class="border-accent/40 bg-accent-soft mt-4 rounded-xl border p-4">
			<p class="text-ink mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold">
				<Icon name="check" size={15} />
				Imported
			</p>
			<ul class="text-ink-muted flex flex-col gap-0.5 text-[12px]">
				{#if result.sessionsCreated.length > 0}
					<li>
						{result.sessionsCreated.length} session{result.sessionsCreated.length > 1 ? 's' : ''}:
						{result.sessionsCreated.join(', ')}
					</li>
				{/if}
				<li>
					{result.exercisesCreated} new exercise{result.exercisesCreated === 1 ? '' : 's'},
					{result.exercisesReused} reused
				</li>
				{#if result.routinesCreated > 0}
					<li>{result.routinesCreated} routine{result.routinesCreated > 1 ? 's' : ''} scheduled</li>
				{/if}
				{#each result.renamed as rename (rename.from)}
					<li>"{rename.from}" was renamed to "{rename.to}" — you already had one.</li>
				{/each}
				{#each result.skipped as note (note)}
					<li>{note}</li>
				{/each}
			</ul>
			<div class="mt-3 flex flex-wrap gap-2">
				<Button variant="secondary" size="sm" href="/library?tab=sessions" iconRight="chevronRight">
					Open the library
				</Button>
				{#if result.routinesCreated > 0}
					<Button variant="ghost" size="sm" href="/">See today</Button>
				{/if}
			</div>
		</div>
	{/if}
</div>
