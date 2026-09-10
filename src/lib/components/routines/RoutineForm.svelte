<script lang="ts">
	import type { Recurrence, RoutineDetail, RoutineInput } from '$domain/models/routine.ts';
	import type { SessionSummary } from '$domain/models/session.ts';
	import { todayIso } from '$domain/services/date.ts';
	import { api, ApiError } from '$client/api.ts';
	import { toasts } from '$client/toast.svelte.ts';
	import Button from '$components/ui/Button.svelte';
	import Field from '$components/ui/Field.svelte';
	import Modal from '$components/ui/Modal.svelte';
	import Select from '$components/ui/Select.svelte';
	import TextInput from '$components/ui/TextInput.svelte';
	import RecurrenceEditor from './RecurrenceEditor.svelte';

	interface Props {
		open: boolean;
		routine?: RoutineDetail | null;
		sessions: SessionSummary[];
		onsaved: () => void;
	}

	let { open = $bindable(), routine = null, sessions, onsaved }: Props = $props();

	let name = $state('');
	let sessionId = $state('');
	let recurrence = $state<Recurrence>({ type: 'weekly', interval: 1, weekdays: [1, 3, 5] });
	let startDate = $state(todayIso());
	let endDate = $state('');
	let timeOfDay = $state('');
	let active = $state(true);
	let saving = $state(false);
	let errors = $state<Record<string, string>>({});

	$effect(() => {
		if (!open) return;
		name = routine?.name ?? '';
		sessionId = routine?.sessionId ?? sessions[0]?.id ?? '';
		recurrence = routine?.recurrence ?? { type: 'weekly', interval: 1, weekdays: [1, 3, 5] };
		startDate = routine?.startDate ?? todayIso();
		endDate = routine?.endDate ?? '';
		timeOfDay = routine?.timeOfDay ?? '';
		active = routine?.active ?? true;
		errors = {};
	});

	async function save() {
		saving = true;
		errors = {};
		const input: RoutineInput = {
			name: name.trim(),
			sessionId,
			recurrence,
			startDate,
			endDate: endDate || null,
			timeOfDay: timeOfDay || null,
			active
		};

		try {
			if (routine) await api.routines.update(routine.id, input);
			else await api.routines.create(input);
			toasts.success(routine ? 'Routine updated' : 'Routine scheduled');
			onsaved();
			open = false;
		} catch (error) {
			if (error instanceof ApiError) {
				errors = error.fields;
				if (Object.keys(error.fields).length === 0) toasts.error(error.message);
			} else {
				toasts.error('Could not save the routine');
			}
		} finally {
			saving = false;
		}
	}
</script>

<Modal
	bind:open
	title={routine ? 'Edit routine' : 'New routine'}
	subtitle="Put a session on repeat."
>
	{#if sessions.length === 0}
		<p class="text-ink-muted py-6 text-center text-[13px]">
			Create a session first — a routine schedules one.
		</p>
	{:else}
		<div class="flex flex-col gap-4">
			<Field label="Session" required error={errors.sessionId} for="routine-session">
				<Select id="routine-session" bind:value={sessionId} invalid={Boolean(errors.sessionId)}>
					{#each sessions as session (session.id)}
						<option value={session.id}>{session.name}</option>
					{/each}
				</Select>
			</Field>

			<Field label="Name" hint="Defaults to the session name" for="routine-name">
				<TextInput id="routine-name" bind:value={name} placeholder="Morning conditioning" />
			</Field>

			<Field label="Repeat">
				<RecurrenceEditor bind:recurrence {startDate} />
			</Field>

			<div class="grid gap-4 sm:grid-cols-2">
				<Field label="Starts" required error={errors.startDate} for="routine-start">
					<TextInput id="routine-start" type="date" bind:value={startDate} />
				</Field>
				<Field label="Ends" hint="Optional" error={errors.endDate} for="routine-end">
					<TextInput id="routine-end" type="date" bind:value={endDate} min={startDate} />
				</Field>
			</div>

			<Field label="Time of day" hint="Orders your day; it does not notify" for="routine-time">
				<TextInput id="routine-time" type="time" bind:value={timeOfDay} class="sm:max-w-40" />
			</Field>

			<label class="border-line flex cursor-pointer items-center gap-2.5 rounded-xl border p-3">
				<input type="checkbox" bind:checked={active} class="accent-accent size-4 rounded" />
				<span class="text-ink text-[13px] font-medium">Active</span>
				<span class="text-ink-subtle text-[12px]">paused routines stop appearing</span>
			</label>
		</div>
	{/if}

	{#snippet footer()}
		<Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
		<Button
			variant="primary"
			loading={saving}
			disabled={sessions.length === 0}
			onclick={save}
		>
			{routine ? 'Save changes' : 'Schedule it'}
		</Button>
	{/snippet}
</Modal>
