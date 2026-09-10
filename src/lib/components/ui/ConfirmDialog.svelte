<script lang="ts">
	import Button from './Button.svelte';
	import Modal from './Modal.svelte';

	interface Props {
		open: boolean;
		title: string;
		message: string;
		confirmLabel?: string;
		danger?: boolean;
		onconfirm: () => void | Promise<void>;
	}

	let {
		open = $bindable(),
		title,
		message,
		confirmLabel = 'Confirm',
		danger = false,
		onconfirm
	}: Props = $props();

	let working = $state(false);

	async function confirm() {
		working = true;
		try {
			await onconfirm();
			open = false;
		} finally {
			working = false;
		}
	}
</script>

<Modal bind:open {title} size="sm">
	<p class="text-ink-muted text-sm leading-relaxed">{message}</p>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
		<Button variant={danger ? 'danger' : 'primary'} loading={working} onclick={confirm}>
			{confirmLabel}
		</Button>
	{/snippet}
</Modal>
