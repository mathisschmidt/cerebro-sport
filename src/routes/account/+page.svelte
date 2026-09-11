<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { api, ApiError } from '$client/api.ts';
	import { authClient, authErrorMessage } from '$client/auth.ts';
	import { toasts } from '$client/toast.svelte.ts';
	import {
		USER_ROLE_LABEL,
		changePasswordSchema,
		changeUsernameSchema
	} from '$domain/models/user.ts';
	import Badge from '$components/ui/Badge.svelte';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import Field from '$components/ui/Field.svelte';
	import Icon from '$components/ui/Icon.svelte';
	import PasswordInput from '$components/ui/PasswordInput.svelte';
	import TextInput from '$components/ui/TextInput.svelte';
	import PageHeader from '$components/shared/PageHeader.svelte';
	import type { PageData } from './$types.ts';

	let { data }: { data: PageData } = $props();

	/** `{ "username": "Already taken" }` — zod issues in the shape a `Field` wants. */
	function issuesToFields(issues: { path: PropertyKey[]; message: string }[]) {
		const fields: Record<string, string> = {};
		for (const issue of issues) {
			const key = issue.path.join('.');
			if (!fields[key]) fields[key] = issue.message;
		}
		return fields;
	}

	// ── Username ──────────────────────────────────────────────────────────

	// svelte-ignore state_referenced_locally — the field starts as the current name; after that it is the draft being typed
	let username = $state(data.user.username);
	let usernameFields = $state<Record<string, string>>({});
	let renaming = $state(false);

	const usernameChanged = $derived(username.trim().toLowerCase() !== data.user.username);

	async function rename(event: SubmitEvent) {
		event.preventDefault();
		usernameFields = {};
		const parsed = changeUsernameSchema.safeParse({ username });
		if (!parsed.success) {
			usernameFields = issuesToFields(parsed.error.issues);
			return;
		}

		renaming = true;
		try {
			const updated = await api.account.changeUsername(parsed.data);
			// The server lowercases; show what was actually saved.
			username = updated.username;
			toasts.success(`You are now ${updated.username}`);
			await invalidateAll();
		} catch (error) {
			if (error instanceof ApiError) {
				usernameFields = error.fields;
				if (Object.keys(error.fields).length === 0) toasts.error(error.message);
			} else {
				toasts.error('Could not change your username');
			}
		} finally {
			renaming = false;
		}
	}

	// ── Password ──────────────────────────────────────────────────────────

	function blankPassword() {
		return { currentPassword: '', newPassword: '', revokeOtherSessions: false };
	}

	let password = $state(blankPassword());
	// A typo guard, not part of what gets sent — same as the register form.
	let confirm = $state('');
	let passwordFields = $state<Record<string, string>>({});
	let passwordError = $state('');
	let changingPassword = $state(false);

	function validatePassword() {
		passwordFields = {};
		const parsed = changePasswordSchema.safeParse(password);
		if (!parsed.success) passwordFields = issuesToFields(parsed.error.issues);
		if (password.newPassword !== confirm) passwordFields.confirm = 'Passwords do not match';
		return parsed.success && Object.keys(passwordFields).length === 0 ? parsed.data : null;
	}

	async function changePassword(event: SubmitEvent) {
		event.preventDefault();
		passwordError = '';
		const input = validatePassword();
		if (!input) return;

		changingPassword = true;
		// Better Auth verifies the current password and hashes the new one; with
		// `revokeOtherSessions` it also re-issues this browser's session, so the
		// person changing it never gets signed out themselves.
		const result = await authClient.changePassword(input);
		changingPassword = false;

		if (result.error) {
			// The one failure that belongs to a field. Everything else is general.
			if (result.error.code === 'INVALID_PASSWORD') {
				passwordFields = { currentPassword: 'That is not your current password' };
			} else {
				passwordError = authErrorMessage(result.error, 'Could not change your password');
			}
			return;
		}

		toasts.success(
			input.revokeOtherSessions
				? 'Password changed — other devices are signed out'
				: 'Password changed'
		);
		password = blankPassword();
		confirm = '';
	}
</script>

<svelte:head><title>Account — Cerebro Sport</title></svelte:head>

<PageHeader title="Account" subtitle="How you sign in." />

<div class="flex flex-col gap-4">
	<!-- Username -->
	<Card>
		<form class="flex flex-col gap-4" onsubmit={rename}>
			<div class="flex items-center gap-3">
				<span
					class="bg-surface-sunken text-ink-muted grid size-11 shrink-0 place-items-center rounded-full text-[15px] font-semibold uppercase"
				>
					{data.user.username.slice(0, 2)}
				</span>
				<div class="min-w-0 flex-1">
					<h2 class="text-ink text-[13px] font-semibold">Username</h2>
					<p class="text-ink-subtle mt-0.5 text-[12px] leading-relaxed">
						What you sign in with. Renaming keeps your data and signs nobody out.
					</p>
				</div>
				<Badge tone={data.user.role === 'admin' ? 'accent' : 'neutral'}>
					{USER_ROLE_LABEL[data.user.role]}
				</Badge>
			</div>

			<Field
				for="username"
				hint="Letters, numbers, dot, dash and underscore"
				error={usernameFields.username}
			>
				<div class="flex gap-2">
					<TextInput
						id="username"
						bind:value={username}
						aria-label="Username"
						autocomplete="username"
						autocapitalize="none"
						spellcheck={false}
						invalid={!!usernameFields.username}
						required
					/>
					<Button
						type="submit"
						variant="primary"
						class="shrink-0"
						loading={renaming}
						disabled={!usernameChanged}
					>
						Save
					</Button>
				</div>
			</Field>
		</form>
	</Card>

	<!-- Password -->
	<Card>
		<form class="flex flex-col gap-4" onsubmit={changePassword}>
			<div>
				<h2 class="text-ink text-[13px] font-semibold">Change password</h2>
				<p class="text-ink-subtle mt-0.5 text-[12px] leading-relaxed">
					You stay signed in on this device either way.
				</p>
			</div>

			<!-- Not shown: lets a password manager file the new password under the right account. -->
			<input
				type="text"
				name="username"
				autocomplete="username"
				value={data.user.username}
				class="sr-only"
				tabindex="-1"
				aria-hidden="true"
				readonly
			/>

			<Field
				label="Current password"
				required
				for="current-password"
				error={passwordFields.currentPassword}
			>
				<PasswordInput
					id="current-password"
					bind:value={password.currentPassword}
					autocomplete="current-password"
					invalid={!!passwordFields.currentPassword}
					required
				/>
			</Field>

			<Field
				label="New password"
				required
				for="new-password"
				hint="At least 8 characters"
				error={passwordFields.newPassword}
			>
				<PasswordInput
					id="new-password"
					bind:value={password.newPassword}
					autocomplete="new-password"
					invalid={!!passwordFields.newPassword}
					required
				/>
			</Field>

			<Field
				label="Confirm new password"
				required
				for="confirm-password"
				error={passwordFields.confirm}
			>
				<PasswordInput
					id="confirm-password"
					bind:value={confirm}
					autocomplete="new-password"
					invalid={!!passwordFields.confirm}
					required
				/>
			</Field>

			<label class="border-line flex cursor-pointer items-center gap-2.5 rounded-xl border p-3">
				<input
					type="checkbox"
					bind:checked={password.revokeOtherSessions}
					class="accent-accent size-4 rounded"
				/>
				<span class="text-ink text-[13px] font-medium">Sign out other devices</span>
				<span class="text-ink-subtle text-[12px]">anywhere else you are signed in</span>
			</label>

			{#if passwordError}
				<p
					class="border-danger/40 bg-danger/8 text-danger flex items-start gap-1.5 rounded-lg border px-3 py-2 text-[12px]"
					role="alert"
				>
					<span class="mt-px shrink-0"><Icon name="alert" size={13} /></span>
					{passwordError}
				</p>
			{/if}

			<div class="flex justify-end">
				<Button type="submit" variant="primary" loading={changingPassword}>Change password</Button>
			</div>
		</form>
	</Card>
</div>
