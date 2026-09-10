<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { api, ApiError } from '$client/api.ts';
	import { toasts } from '$client/toast.svelte.ts';
	import {
		USER_ROLE_LABEL,
		createUserSchema,
		type ManagedUser,
		type UserRole
	} from '$domain/models/user.ts';
	import { formatDateLabel } from '$domain/services/date.ts';
	import Badge from '$components/ui/Badge.svelte';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import ConfirmDialog from '$components/ui/ConfirmDialog.svelte';
	import Field from '$components/ui/Field.svelte';
	import Icon from '$components/ui/Icon.svelte';
	import Modal from '$components/ui/Modal.svelte';
	import Select from '$components/ui/Select.svelte';
	import PasswordInput from '$components/ui/PasswordInput.svelte';
	import TextInput from '$components/ui/TextInput.svelte';
	import PageHeader from '$components/shared/PageHeader.svelte';
	import type { PageData } from './$types.ts';

	let { data }: { data: PageData } = $props();

	// Derived, not copied: the server is the only source of truth for this, and
	// every change ends in `invalidateAll()`.
	const registrationEnabled = $derived(data.settings.registrationEnabled);
	let savingSetting = $state(false);

	let addOpen = $state(false);
	let form = $state({ username: '', password: '', role: 'user' as UserRole });
	let fields = $state<Record<string, string>>({});
	let creating = $state(false);

	let pendingDelete = $state<ManagedUser | null>(null);
	let confirmOpen = $state(false);

	async function toggleRegistration() {
		const next = !registrationEnabled;
		savingSetting = true;
		try {
			await api.settings.update({ registrationEnabled: next });
			toasts.success(next ? 'Anyone can register now' : 'Registration closed');
			await invalidateAll();
		} catch (error) {
			toasts.error(error instanceof ApiError ? error.message : 'Could not save that');
		} finally {
			savingSetting = false;
		}
	}

	function openAdd() {
		form = { username: '', password: '', role: 'user' };
		fields = {};
		addOpen = true;
	}

	async function createUser() {
		fields = {};
		const parsed = createUserSchema.safeParse(form);
		if (!parsed.success) {
			for (const issue of parsed.error.issues) {
				const key = issue.path.join('.');
				if (!fields[key]) fields[key] = issue.message;
			}
			return;
		}

		creating = true;
		try {
			const created = await api.admin.createUser(parsed.data);
			toasts.success(`Added ${created.username}`);
			addOpen = false;
			await invalidateAll();
		} catch (error) {
			if (error instanceof ApiError) {
				fields = error.fields;
				if (Object.keys(error.fields).length === 0) toasts.error(error.message);
			} else {
				toasts.error('Could not add that user');
			}
		} finally {
			creating = false;
		}
	}

	async function changeRole(user: ManagedUser, role: UserRole) {
		if (role === user.role) return;
		try {
			await api.admin.setRole({ userId: user.id, role });
			toasts.success(`${user.username} is now ${USER_ROLE_LABEL[role].toLowerCase()}`);
			await invalidateAll();
		} catch (error) {
			toasts.error(error instanceof ApiError ? error.message : 'Could not change that role');
			await invalidateAll();
		}
	}

	function askDelete(user: ManagedUser) {
		pendingDelete = user;
		confirmOpen = true;
	}

	async function removeUser() {
		if (!pendingDelete) return;
		try {
			await api.admin.removeUser(pendingDelete.id);
			toasts.success(`Deleted ${pendingDelete.username}`);
			await invalidateAll();
		} catch (error) {
			toasts.error(error instanceof ApiError ? error.message : 'Could not delete that user');
		} finally {
			pendingDelete = null;
		}
	}
</script>

<svelte:head><title>Admin — Van Damme</title></svelte:head>

<PageHeader title="Admin" subtitle="Who can get in, and who is already here.">
	{#snippet actions()}
		<Button variant="primary" icon="plus" onclick={openAdd}>
			<span class="max-sm:hidden">Add user</span>
		</Button>
	{/snippet}
</PageHeader>

<div class="flex flex-col gap-4">
	<!-- Registration -->
	<Card>
		<div class="flex flex-wrap items-start gap-3">
			<span
				class="grid size-9 shrink-0 place-items-center rounded-xl {registrationEnabled
					? 'bg-accent-soft text-accent'
					: 'bg-surface-sunken text-ink-subtle'}"
			>
				<Icon name={registrationEnabled ? 'zap' : 'settings'} size={17} />
			</span>
			<div class="min-w-[13rem] flex-1">
				<h2 class="text-ink text-[13px] font-semibold">Open registration</h2>
				<p class="text-ink-subtle mt-0.5 text-[12px] leading-relaxed">
					{registrationEnabled
						? 'Anyone who can reach this app can create an account for themselves.'
						: 'The sign-up form is closed. Only you can add accounts, from here.'}
				</p>
			</div>
			<div class="flex shrink-0 items-center gap-2 max-sm:w-full">
				<Badge tone={registrationEnabled ? 'accent' : 'neutral'}>
					{registrationEnabled ? 'Open' : 'Closed'}
				</Badge>
				<Button
					variant={registrationEnabled ? 'outline' : 'primary'}
					size="sm"
					loading={savingSetting}
					onclick={toggleRegistration}
				>
					{registrationEnabled ? 'Close it' : 'Open it'}
				</Button>
			</div>
		</div>
	</Card>

	<!-- Users -->
	<Card padded={false}>
		<div class="border-line flex items-center justify-between border-b px-4 py-3 sm:px-5">
			<h2 class="text-ink text-[13px] font-semibold">
				Accounts <span class="text-ink-subtle font-normal">({data.users.length})</span>
			</h2>
		</div>

		<ul class="divide-line divide-y">
			{#each data.users as user (user.id)}
				<li class="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
					<span
						class="bg-surface-sunken text-ink-muted grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold uppercase"
					>
						{user.username.slice(0, 2)}
					</span>

					<div class="min-w-[9rem] flex-1">
						<div class="flex flex-wrap items-center gap-1.5">
							<p class="text-ink text-[13px] font-medium">{user.username}</p>
							{#if user.id === data.user?.id}
								<Badge tone="accent">you</Badge>
							{/if}
						</div>
						<p class="text-ink-subtle mt-0.5 text-[11px]">
							Joined {formatDateLabel(user.createdAt.slice(0, 10))} ·
							{user.sessionCount} session{user.sessionCount === 1 ? '' : 's'} ·
							{user.workoutCount} workout{user.workoutCount === 1 ? '' : 's'}
						</p>
					</div>

					<div class="flex shrink-0 items-center gap-2">
						<Select
							value={user.role}
							class="w-28"
							aria-label="Role for {user.username}"
							onchange={(event) =>
								changeRole(user, (event.currentTarget as HTMLSelectElement).value as UserRole)}
						>
							<option value="user">{USER_ROLE_LABEL.user}</option>
							<option value="admin">{USER_ROLE_LABEL.admin}</option>
						</Select>
						<Button
							variant="danger"
							size="sm"
							icon="trash"
							aria-label="Delete {user.username}"
							disabled={user.id === data.user?.id}
							onclick={() => askDelete(user)}
						/>
					</div>
				</li>
			{/each}
		</ul>
	</Card>
</div>

<Modal bind:open={addOpen} title="Add a user" subtitle="They can change their password once in.">
	<div class="flex flex-col gap-4">
		<Field label="Username" required for="new-username" error={fields.username}>
			<TextInput
				id="new-username"
				bind:value={form.username}
				autocapitalize="none"
				spellcheck={false}
				invalid={!!fields.username}
			/>
		</Field>
		<Field
			label="Temporary password"
			required
			for="new-password"
			hint="At least 8 characters"
			error={fields.password}
		>
			<PasswordInput
				id="new-password"
				bind:value={form.password}
				autocomplete="new-password"
				invalid={!!fields.password}
			/>
		</Field>
		<Field label="Role" for="new-role">
			<Select id="new-role" bind:value={form.role}>
				<option value="user">{USER_ROLE_LABEL.user} — their own training only</option>
				<option value="admin">{USER_ROLE_LABEL.admin} — can manage accounts</option>
			</Select>
		</Field>
	</div>

	{#snippet footer()}
		<Button variant="ghost" onclick={() => (addOpen = false)}>Cancel</Button>
		<Button variant="primary" loading={creating} onclick={createUser}>Add user</Button>
	{/snippet}
</Modal>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Delete this account?"
	message={pendingDelete
		? `${pendingDelete.username} and all their training data — ${pendingDelete.sessionCount} session(s) and ${pendingDelete.workoutCount} workout(s) — will be permanently deleted.`
		: ''}
	confirmLabel="Delete"
	danger
	onconfirm={removeUser}
/>
