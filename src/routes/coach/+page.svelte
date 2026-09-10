<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		buildCoachPrompt,
		buildSkillFile,
		emptyBrief,
		type CoachBrief
	} from '$domain/services/coach-prompt.ts';
	import { toasts } from '$client/toast.svelte.ts';
	import Badge from '$components/ui/Badge.svelte';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import CopyButton from '$components/ui/CopyButton.svelte';
	import Icon from '$components/ui/Icon.svelte';
	import SegmentedControl from '$components/ui/SegmentedControl.svelte';
	import TextArea from '$components/ui/TextArea.svelte';
	import BriefForm from '$components/coach/BriefForm.svelte';
	import PackImport from '$components/coach/PackImport.svelte';
	import PageHeader from '$components/shared/PageHeader.svelte';
	import type { PageData } from './$types.ts';

	let { data }: { data: PageData } = $props();

	/**
	 * Two ways in, because there are two kinds of visit: one where you need the
	 * prompt written for you, and one where your own agent already produced a
	 * file. The mode lives in the URL so it is linkable and survives a reload,
	 * matching how the library's tabs work.
	 */
	type Mode = 'ask' | 'import';

	const MODES = [
		{ value: 'ask' as const, label: 'Ask an AI' },
		{ value: 'import' as const, label: 'I have a file' }
	];

	const mode = $derived(page.url.searchParams.get('mode') === 'import' ? 'import' : 'ask');
	const modeProxy = {
		get value(): Mode {
			return mode;
		},
		set value(next: Mode) {
			void goto(`/coach?mode=${next}`, { replaceState: true, noScroll: true, keepFocus: true });
		}
	};

	let brief = $state<CoachBrief>(emptyBrief());
	let prompt = $state('');
	/** Held here, not in the import card, so switching modes keeps it. */
	let packText = $state('');

	const exerciseNames = $derived(data.exercises.map((exercise) => exercise.name));

	function generate() {
		if (!brief.goal.trim()) {
			toasts.error('Tell the coach what you want first');
			return;
		}
		prompt = buildCoachPrompt(brief, {
			libraryExercises: exerciseNames,
			librarySessions: data.sessions.map((session) => session.name),
			today: data.today
		});
	}

	function downloadSkill() {
		const blob = new Blob([buildSkillFile()], { type: 'text/markdown;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = 'SKILL.md';
		link.click();
		URL.revokeObjectURL(url);
	}
</script>

<svelte:head><title>Coach — Cerebro Sport</title></svelte:head>

<PageHeader
	title="Coach"
	subtitle="Have an AI write your sessions — or import a file you already have."
>
	{#snippet actions()}
		<!-- Hidden on phones: the card at the foot of the page already offers it,
		     and an icon with no room for its label reads as an orphan. -->
		<Button variant="ghost" icon="note" class="max-sm:hidden" onclick={downloadSkill}>
			Skill file
		</Button>
	{/snippet}
</PageHeader>

<SegmentedControl bind:value={modeProxy.value} segments={MODES} class="mb-4 w-full sm:w-auto" />

<div class="flex flex-col gap-4">
	{#if mode === 'ask'}
		<!-- Step 1 -->
		<Card>
			<div class="mb-4 flex items-center gap-2.5">
				<span
					class="bg-accent text-accent-ink grid size-6 shrink-0 place-items-center rounded-lg text-[12px] font-bold"
				>
					1
				</span>
				<h2 class="text-ink text-[15px] font-semibold">What do you want to train?</h2>
			</div>

			<BriefForm bind:brief libraryExercises={exerciseNames} />

			<div class="mt-4 flex justify-end">
				<Button variant="primary" icon="zap" onclick={generate}>Generate the prompt</Button>
			</div>
		</Card>

		<!-- Step 2 -->
		<Card>
			<div class="mb-3 flex flex-wrap items-center gap-2.5">
				<span
					class="grid size-6 shrink-0 place-items-center rounded-lg text-[12px] font-bold {prompt
						? 'bg-accent text-accent-ink'
						: 'bg-surface-sunken text-ink-subtle'}"
				>
					2
				</span>
				<h2 class="text-ink text-[15px] font-semibold">Copy this into any AI chat</h2>
				{#if prompt}
					<Badge>{prompt.length.toLocaleString()} characters</Badge>
					<div class="ml-auto">
						<CopyButton
							text={prompt}
							size="sm"
							label="Copy prompt"
							copiedLabel="Copied!"
							variant="primary"
						/>
					</div>
				{/if}
			</div>

			{#if prompt}
				<p class="text-ink-subtle mb-2 text-[12px]">
					Paste it into ChatGPT, Claude, Gemini — anything. It carries your library and the full
					file format, so the reply comes back ready to import.
				</p>
				<TextArea value={prompt} rows={12} readonly class="font-mono !text-[11px] leading-relaxed" />
			{:else}
				<p
					class="text-ink-subtle border-line rounded-xl border border-dashed px-4 py-8 text-center text-[13px]"
				>
					Fill in step 1 and the prompt appears here.
				</p>
			{/if}
		</Card>

		<!-- Step 3 -->
		<PackImport
			exercises={data.exercises}
			sessions={data.sessions}
			today={data.today}
			step={3}
			title="Bring the answer back"
			bind:raw={packText}
		/>
	{:else}
		<PackImport
			exercises={data.exercises}
			sessions={data.sessions}
			today={data.today}
			title="Import a training pack"
			hint="Anything that produces the training pack format works — your own agent, a script, or a file you saved earlier. It is checked and previewed before anything is written."
			bind:raw={packText}
		/>
	{/if}

	<!-- Skill file -->
	<Card>
		<div class="flex flex-wrap items-start gap-3">
			<span
				class="bg-surface-sunken text-ink-subtle grid size-9 shrink-0 place-items-center rounded-xl"
			>
				<Icon name="note" size={17} />
			</span>
			<!-- A real minimum width, not min-w-0: otherwise the text column shrinks
			     to a sliver on a phone instead of wrapping the buttons below it. -->
			<div class="min-w-[13rem] flex-1">
				<h2 class="text-ink text-[13px] font-semibold">Build your own agent</h2>
				<p class="text-ink-subtle mt-0.5 text-[12px] leading-relaxed">
					The complete format rules, packaged as a skill file. Drop it into Claude Code, an agent
					framework or a custom GPT and you can ask for a session in plain language — then bring the
					file straight back here.
				</p>
			</div>
			<div class="flex shrink-0 gap-2 max-sm:w-full">
				<CopyButton text={buildSkillFile()} size="sm" label="Copy" />
				<Button variant="secondary" size="sm" icon="arrowDown" onclick={downloadSkill}>
					SKILL.md
				</Button>
			</div>
		</div>
	</Card>
</div>
