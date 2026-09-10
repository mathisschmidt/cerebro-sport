<script lang="ts">
	import { page } from '$app/state';
	import Button from '$components/ui/Button.svelte';
	import EmptyState from '$components/ui/EmptyState.svelte';
</script>

<div class="mx-auto max-w-md py-12">
	<EmptyState
		icon="alert"
		title={page.status === 404 ? 'Page not found' : 'Something went wrong'}
		description={page.error?.message ?? 'Try again, or head back to today.'}
	>
		{#snippet action()}
			<Button variant="primary" href="/" icon="home">Back to today</Button>
		{/snippet}
	</EmptyState>
</div>
