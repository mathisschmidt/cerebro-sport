<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient, authErrorMessage } from '$client/auth.ts';
	import { emailForUsername, passwordSchema, usernameSchema } from '$domain/models/user.ts';
	import Button from '$components/ui/Button.svelte';
	import Field from '$components/ui/Field.svelte';
	import Icon from '$components/ui/Icon.svelte';
	import PasswordInput from '$components/ui/PasswordInput.svelte';
	import TextInput from '$components/ui/TextInput.svelte';

	let username = $state('');
	let password = $state('');
	let confirm = $state('');
	let error = $state('');
	let fields = $state<Record<string, string>>({});
	let busy = $state(false);

	function validate(): boolean {
		fields = {};
		const name = usernameSchema.safeParse(username);
		if (!name.success) fields.username = name.error.issues[0]?.message ?? 'Invalid username';
		const pass = passwordSchema.safeParse(password);
		if (!pass.success) fields.password = pass.error.issues[0]?.message ?? 'Invalid password';
		if (password !== confirm) fields.confirm = 'Passwords do not match';
		return Object.keys(fields).length === 0;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		if (!validate()) return;

		busy = true;
		const name = username.trim().toLowerCase();
		const result = await authClient.signUp.email({
			// No mail is configured, so the address is derived rather than asked for.
			email: emailForUsername(name),
			password,
			name,
			username: name
		});
		busy = false;

		if (result.error) {
			error = authErrorMessage(result.error, 'Could not create that account');
			return;
		}
		await goto('/', { invalidateAll: true });
	}
</script>

<svelte:head><title>Create an account — Cerebro Sport</title></svelte:head>

<div class="flex min-h-[100dvh] items-center justify-center px-4 py-10">
	<div class="w-full max-w-sm">
		<div class="mb-7 flex flex-col items-center text-center">
			<span class="bg-accent text-accent-ink mb-3 grid size-12 place-items-center rounded-2xl">
				<Icon name="dumbbell" size={26} />
			</span>
			<h1 class="text-ink text-xl font-semibold">Create your account</h1>
			<p class="text-ink-subtle mt-1 text-[13px]">Your training data is yours alone.</p>
		</div>

		<form class="card flex flex-col gap-4 p-5" onsubmit={submit}>
			<Field label="Username" for="username" error={fields.username}>
				<TextInput
					id="username"
					bind:value={username}
					autocomplete="username"
					autocapitalize="none"
					spellcheck={false}
					invalid={!!fields.username}
					required
				/>
			</Field>

			<Field label="Password" for="password" hint="At least 8 characters" error={fields.password}>
				<PasswordInput
					id="password"
					bind:value={password}
					autocomplete="new-password"
					invalid={!!fields.password}
					required
				/>
			</Field>

			<Field label="Confirm password" for="confirm" error={fields.confirm}>
				<PasswordInput
					id="confirm"
					bind:value={confirm}
					autocomplete="new-password"
					invalid={!!fields.confirm}
					required
				/>
			</Field>

			{#if error}
				<p
					class="border-danger/40 bg-danger/8 text-danger flex items-start gap-1.5 rounded-lg border px-3 py-2 text-[12px]"
					role="alert"
				>
					<span class="mt-px shrink-0"><Icon name="alert" size={13} /></span>
					{error}
				</p>
			{/if}

			<Button type="submit" variant="primary" size="lg" full loading={busy}>Create account</Button>

			<p class="text-ink-subtle text-center text-[12px]">
				Already have one?
				<a class="text-accent hover:underline" href="/login">Sign in</a>
			</p>
		</form>
	</div>
</div>
