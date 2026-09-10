<script lang="ts">
	import { fly } from 'svelte/transition';
	import { toasts } from '$client/toast.svelte.ts';
	import Icon from './Icon.svelte';

	const TONES = {
		info: { icon: 'note', color: 'text-info' },
		success: { icon: 'check', color: 'text-success' },
		error: { icon: 'alert', color: 'text-danger' }
	} as const;
</script>

<div
	class="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6"
>
	{#each toasts.items as toast (toast.id)}
		<div
			class="bg-surface-raised border-line shadow-float pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-3.5 py-3"
			transition:fly={{ y: 12, duration: 180 }}
			role="status"
		>
			<span class="mt-0.5 {TONES[toast.tone].color}">
				<Icon name={TONES[toast.tone].icon} size={16} />
			</span>
			<p class="text-ink flex-1 text-[13px] leading-snug">{toast.message}</p>
			<button
				type="button"
				class="text-ink-subtle hover:text-ink -mt-0.5 -mr-1 shrink-0 rounded p-1"
				onclick={() => toasts.dismiss(toast.id)}
				aria-label="Dismiss"
			>
				<Icon name="close" size={14} />
			</button>
		</div>
	{/each}
</div>
