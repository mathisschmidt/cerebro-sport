<script lang="ts">
	import SessionEditor from '$components/sessions/SessionEditor.svelte';
	import PageHeader from '$components/shared/PageHeader.svelte';
	import type { PageData } from './$types.ts';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Edit {data.session.name} — Van Damme</title></svelte:head>

<PageHeader
	title="Edit session"
	subtitle={data.session.name}
	back={{ href: `/library/sessions/${data.session.id}`, label: data.session.name }}
/>

<SessionEditor session={data.session} exercises={data.exercises} />
