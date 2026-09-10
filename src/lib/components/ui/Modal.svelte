<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	/**
	 * A dialog on desktop, a bottom sheet on phones — the same component, because
	 * every form in the app is edited on both.
	 */
	interface Props {
		open: boolean;
		title: string;
		subtitle?: string;
		size?: 'sm' | 'md' | 'lg';
		children: Snippet;
		footer?: Snippet;
		onclose?: () => void;
	}

	let {
		open = $bindable(),
		title,
		subtitle,
		size = 'md',
		children,
		footer,
		onclose
	}: Props = $props();

	const WIDTHS = { sm: 'sm:max-w-md', md: 'sm:max-w-2xl', lg: 'sm:max-w-4xl' };

	function close() {
		open = false;
		onclose?.();
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
		}
	}

	// The page behind a sheet must not scroll while it is open.
	$effect(() => {
		if (!open) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previous;
		};
	});
</script>

<svelte:window {onkeydown} />

{#if open}
	<div class="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
		<button
			type="button"
			class="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
			onclick={close}
			aria-label="Close dialog"
		></button>

		<div
			class="bg-bg-elevated border-line shadow-float relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl border sm:rounded-2xl {WIDTHS[
				size
			]}"
			role="dialog"
			aria-modal="true"
			aria-label={title}
		>
			<!-- Drag affordance: reads as a sheet on touch, invisible on desktop. -->
			<div class="flex justify-center pt-2 sm:hidden">
				<span class="bg-line-strong h-1 w-9 rounded-full"></span>
			</div>

			<header class="flex items-start gap-3 px-5 pt-4 pb-3 sm:pt-5">
				<div class="min-w-0 flex-1">
					<h2 class="text-ink truncate text-base font-semibold">{title}</h2>
					{#if subtitle}
						<p class="text-ink-subtle mt-0.5 text-[13px]">{subtitle}</p>
					{/if}
				</div>
				<button
					type="button"
					class="text-ink-subtle hover:text-ink hover:bg-surface -mt-1 -mr-1.5 grid size-9 shrink-0 place-items-center rounded-lg transition-colors"
					onclick={close}
					aria-label="Close"
				>
					<Icon name="close" size={18} />
				</button>
			</header>

			<div class="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
				{@render children()}
			</div>

			{#if footer}
				<footer
					class="border-line bg-bg-elevated pb-safe flex items-center justify-end gap-2 rounded-b-2xl border-t px-5 py-3"
				>
					{@render footer()}
				</footer>
			{/if}
		</div>
	</div>
{/if}
