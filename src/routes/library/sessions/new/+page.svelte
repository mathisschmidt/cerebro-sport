<script lang="ts">
	import SessionEditor from '$components/sessions/SessionEditor.svelte';
	import PageHeader from '$components/shared/PageHeader.svelte';
	import type { PageData } from './$types.ts';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>New session — Van Damme</title></svelte:head>

<PageHeader
	title="New session"
	subtitle="Group exercises into blocks. A block repeats for a number of rounds."
	back={{ href: '/library?tab=sessions', label: 'Library' }}
/>

<SessionEditor exercises={data.exercises} />
