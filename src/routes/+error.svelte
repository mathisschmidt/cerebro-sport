<script lang="ts">
	import { page } from '$app/state';
	import { connectivity } from '$client/offline/index.ts';
	import Button from '$components/ui/Button.svelte';
	import EmptyState from '$components/ui/EmptyState.svelte';

	/**
	 * Offline, a page that was never opened on this device has nothing stored to
	 * show. That is not an error worth alarming anyone over, so it says so plainly.
	 */
	const offline = $derived(!connectivity.online || page.status === 503);
</script>

<div class="mx-auto max-w-md py-12">
	{#if offline}
		<EmptyState
			icon="alert"
			title="Not available offline yet"
			description="This page has not been opened online on this device. Today, your library and your metrics are — and you can still run a session."
		>
			{#snippet action()}
				<Button variant="primary" href="/" icon="home">Back to today</Button>
			{/snippet}
		</EmptyState>
	{:else}
		<EmptyState
			icon="alert"
			title={page.status === 404 ? 'Page not found' : 'Something went wrong'}
			description={page.error?.message ?? 'Try again, or head back to today.'}
		>
			{#snippet action()}
				<Button variant="primary" href="/" icon="home">Back to today</Button>
			{/snippet}
		</EmptyState>
	{/if}
</div>
