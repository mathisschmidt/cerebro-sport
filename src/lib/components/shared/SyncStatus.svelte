<script lang="ts">
	import { connectivity, outbox } from '$client/offline/index.ts';
	import Icon from '$components/ui/Icon.svelte';

	/**
	 * Whether the server is up to date with this phone, in a word. Hidden when it
	 * is — the usual case online — so it only ever appears when it has news.
	 */
	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();

	const state = $derived.by(() => {
		if (outbox.signedOut) return { label: 'Sign in to sync', tone: 'warning' } as const;
		if (outbox.rejected > 0) {
			const runs = outbox.rejected === 1 ? '1 run' : `${outbox.rejected} runs`;
			return { label: `${runs} not synced`, tone: 'danger' } as const;
		}
		if (outbox.pending > 0) {
			const runs = outbox.pending === 1 ? '1 run' : `${outbox.pending} runs`;
			return {
				label: connectivity.online ? `Syncing ${runs}` : `${runs} to sync`,
				tone: 'neutral'
			} as const;
		}
		if (!connectivity.online) return { label: 'Offline', tone: 'neutral' } as const;
		return null;
	});

	const TONES = {
		neutral: 'border-line text-ink-muted bg-surface-sunken',
		warning: 'border-warning/30 text-warning bg-warning/12',
		danger: 'border-danger/30 text-danger bg-danger/12'
	};
</script>

{#if state}
	<span
		class="inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium whitespace-nowrap {TONES[
			state.tone
		]} {className}"
		role="status"
	>
		<Icon name={connectivity.online ? 'repeat' : 'alert'} size={12} />
		{state.label}
	</span>
{/if}
