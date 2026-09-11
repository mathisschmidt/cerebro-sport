<script lang="ts">
	import { authClient, authErrorMessage } from '$client/auth.ts';
	import { toasts } from '$client/toast.svelte.ts';
	import { USER_ROLE_LABEL, changePasswordSchema } from '$domain/models/user.ts';
	import Badge from '$components/ui/Badge.svelte';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import Field from '$components/ui/Field.svelte';
	import Icon from '$components/ui/Icon.svelte';
	import PasswordInput from '$components/ui/PasswordInput.svelte';
	import PageHeader from '$components/shared/PageHeader.svelte';
	import type { PageData } from './$types.ts';

	let { data }: { data: PageData } = $props();

	function blank() {
		return { currentPassword: '', newPassword: '', revokeOtherSessions: false };
	}

	let form = $state(blank());
	// A typo guard, not part of what gets sent — same as the register form.
	let confirm = $state('');
	let fields = $state<Record<string, string>>({});
	let error = $state('');
	let busy = $state(false);

	function validate() {
		fields = {};
		const parsed = changePasswordSchema.safeParse(form);
		if (!parsed.success) {
			for (const issue of parsed.error.issues) {
				const key = issue.path.join('.');
				if (!fields[key]) fields[key] = issue.message;
			}
		}
		if (form.newPassword !== confirm) fields.confirm = 'Passwords do not match';
		return parsed.success && Object.keys(fields).length === 0 ? parsed.data : null;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		const input = validate();
		if (!input) return;

		busy = true;
		// Better Auth verifies the current password and hashes the new one; with
		// `revokeOtherSessions` it also re-issues this browser's session, so the
		// person changing it never gets signed out themselves.
		const result = await authClient.changePassword(input);
		busy = false;

		if (result.error) {
			// The one failure that belongs to a field. Everything else is general.
			if (result.error.code === 'INVALID_PASSWORD') {
				fields = { currentPassword: 'That is not your current password' };
			} else {
				error = authErrorMessage(result.error, 'Could not change your password');
			}
			return;
		}

		toasts.success(
			input.revokeOtherSessions
				? 'Password changed — other devices are signed out'
				: 'Password changed'
		);
		form = blank();
		confirm = '';
	}
</script>

<svelte:head><title>Account — Cerebro Sport</title></svelte:head>

<PageHeader title="Account" subtitle="How you sign in." />

<div class="flex flex-col gap-4">
	<!-- Who -->
	<Card>
		<div class="flex items-center gap-3">
			<span
				class="bg-surface-sunken text-ink-muted grid size-11 shrink-0 place-items-center rounded-full text-[15px] font-semibold uppercase"
			>
				{data.user.username.slice(0, 2)}
			</span>
			<div class="min-w-0 flex-1">
				<p class="text-ink truncate text-[15px] font-semibold">{data.user.username}</p>
				<p class="text-ink-subtle mt-0.5 text-[12px]">Your username is what you sign in with.</p>
			</div>
			<Badge tone={data.user.role === 'admin' ? 'accent' : 'neutral'}>
				{USER_ROLE_LABEL[data.user.role]}
			</Badge>
		</div>
	</Card>

	<!-- Password -->
	<Card>
		<form class="flex flex-col gap-4" onsubmit={submit}>
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
				error={fields.currentPassword}
			>
				<PasswordInput
					id="current-password"
					bind:value={form.currentPassword}
					autocomplete="current-password"
					invalid={!!fields.currentPassword}
					required
				/>
			</Field>

			<Field
				label="New password"
				required
				for="new-password"
				hint="At least 8 characters"
				error={fields.newPassword}
			>
				<PasswordInput
					id="new-password"
					bind:value={form.newPassword}
					autocomplete="new-password"
					invalid={!!fields.newPassword}
					required
				/>
			</Field>

			<Field label="Confirm new password" required for="confirm-password" error={fields.confirm}>
				<PasswordInput
					id="confirm-password"
					bind:value={confirm}
					autocomplete="new-password"
					invalid={!!fields.confirm}
					required
				/>
			</Field>

			<label class="border-line flex cursor-pointer items-center gap-2.5 rounded-xl border p-3">
				<input
					type="checkbox"
					bind:checked={form.revokeOtherSessions}
					class="accent-accent size-4 rounded"
				/>
				<span class="text-ink text-[13px] font-medium">Sign out other devices</span>
				<span class="text-ink-subtle text-[12px]">anywhere else you are signed in</span>
			</label>

			{#if error}
				<p
					class="border-danger/40 bg-danger/8 text-danger flex items-start gap-1.5 rounded-lg border px-3 py-2 text-[12px]"
					role="alert"
				>
					<span class="mt-px shrink-0"><Icon name="alert" size={13} /></span>
					{error}
				</p>
			{/if}

			<div class="flex justify-end">
				<Button type="submit" variant="primary" loading={busy}>Change password</Button>
			</div>
		</form>
	</Card>
</div>
