<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { authClient, authErrorMessage } from '$client/auth.ts';
	import Button from '$components/ui/Button.svelte';
	import Field from '$components/ui/Field.svelte';
	import Icon from '$components/ui/Icon.svelte';
	import PasswordInput from '$components/ui/PasswordInput.svelte';
	import TextInput from '$components/ui/TextInput.svelte';
	import type { PageData } from './$types.ts';

	let { data }: { data: PageData } = $props();

	let username = $state('');
	let password = $state('');
	let error = $state('');
	let busy = $state(false);

	/** Where the guard wanted to send them before it asked for a sign-in. */
	const redirectTo = $derived(page.url.searchParams.get('redirect') || '/');

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		busy = true;
		const result = await authClient.signIn.username({ username: username.trim(), password });
		busy = false;

		if (result.error) {
			error = authErrorMessage(result.error, 'Wrong username or password');
			return;
		}
		await goto(redirectTo, { invalidateAll: true });
	}
</script>

<svelte:head><title>Sign in — Van Damme</title></svelte:head>

<div class="flex min-h-[100dvh] items-center justify-center px-4 py-10">
	<div class="w-full max-w-sm">
		<div class="mb-7 flex flex-col items-center text-center">
			<span class="bg-accent text-accent-ink mb-3 grid size-12 place-items-center rounded-2xl">
				<Icon name="dumbbell" size={26} />
			</span>
			<h1 class="text-ink text-xl font-semibold">Van Damme</h1>
			<p class="text-ink-subtle mt-1 text-[13px]">Sign in to your training log.</p>
		</div>

		<form class="card flex flex-col gap-4 p-5" onsubmit={submit}>
			<Field label="Username" for="username">
				<TextInput
					id="username"
					bind:value={username}
					autocomplete="username"
					autocapitalize="none"
					spellcheck={false}
					required
					placeholder="admin"
				/>
			</Field>

			<Field label="Password" for="password">
				<PasswordInput id="password" bind:value={password} autocomplete="current-password" required />
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

			<Button type="submit" variant="primary" size="lg" full loading={busy}>Sign in</Button>

			{#if data.registrationEnabled}
				<p class="text-ink-subtle text-center text-[12px]">
					No account?
					<a class="text-accent hover:underline" href="/register">Create one</a>
				</p>
			{/if}
		</form>

		{#if data.freshInstall}
			<p
				class="border-line text-ink-subtle mt-4 rounded-xl border border-dashed px-4 py-3 text-center text-[12px] leading-relaxed"
			>
				Fresh install — sign in with <code class="text-ink">admin</code> /
				<code class="text-ink">admin123</code>, then change the password.
			</p>
		{/if}
	</div>
</div>
