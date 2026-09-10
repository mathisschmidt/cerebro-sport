<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import Icon, { type IconName } from '$components/ui/Icon.svelte';
	import Toaster from '$components/ui/Toaster.svelte';
	import { theme } from '$client/theme.svelte.ts';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	interface NavItem {
		href: string;
		label: string;
		icon: IconName;
	}

	const NAV: NavItem[] = [
		{ href: '/', label: 'Today', icon: 'home' },
		{ href: '/library', label: 'Library', icon: 'library' },
		{ href: '/coach', label: 'Coach', icon: 'zap' },
		{ href: '/metrics', label: 'Metrics', icon: 'chart' }
	];

	function isActive(href: string): boolean {
		return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	}

	/** The runner takes the whole screen — chrome would only get in the way. */
	const immersive = $derived(page.url.pathname.startsWith('/run/'));
</script>

<svelte:head>
	<title>Van Damme — Training</title>
</svelte:head>

{#if immersive}
	{@render children()}
{:else}
	<div class="text-ink min-h-[100dvh] lg:flex">
		<!-- Desktop rail -->
		<aside
			class="border-line bg-bg-elevated sticky top-0 hidden h-[100dvh] w-60 shrink-0 flex-col border-r px-3 py-5 lg:flex"
		>
			<a href="/" class="mb-6 flex items-center gap-2.5 px-2">
				<span class="bg-accent text-accent-ink grid size-8 place-items-center rounded-lg">
					<Icon name="dumbbell" size={18} />
				</span>
				<span class="text-[15px] leading-tight font-semibold">
					Van&nbsp;Damme
					<span class="text-ink-subtle block text-[11px] font-normal">Training log</span>
				</span>
			</a>

			<nav class="flex flex-col gap-0.5">
				{#each NAV as item (item.href)}
					<a
						href={item.href}
						class="flex h-10 items-center gap-3 rounded-[10px] px-3 text-sm font-medium transition-colors
						{isActive(item.href)
							? 'bg-accent-soft text-accent'
							: 'text-ink-muted hover:bg-surface hover:text-ink'}"
						aria-current={isActive(item.href) ? 'page' : undefined}
					>
						<Icon name={item.icon} size={18} />
						{item.label}
					</a>
				{/each}
			</nav>

			<div class="mt-auto">
				<button
					type="button"
					class="text-ink-muted hover:bg-surface hover:text-ink flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-sm font-medium transition-colors"
					onclick={() => theme.toggle()}
				>
					<Icon name={theme.current === 'dark' ? 'sun' : 'moon'} size={18} />
					{theme.current === 'dark' ? 'Light mode' : 'Dark mode'}
				</button>
			</div>
		</aside>

		<div class="flex min-w-0 flex-1 flex-col">
			<!-- Mobile header -->
			<header
				class="border-line bg-bg/85 pt-safe sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 backdrop-blur-md lg:hidden"
			>
				<a href="/" class="flex items-center gap-2">
					<span class="bg-accent text-accent-ink grid size-7 place-items-center rounded-lg">
						<Icon name="dumbbell" size={16} />
					</span>
					<span class="text-sm font-semibold">Van&nbsp;Damme</span>
				</a>
				<button
					type="button"
					class="text-ink-muted hover:text-ink -mr-2 grid size-9 place-items-center rounded-lg"
					onclick={() => theme.toggle()}
					aria-label="Switch theme"
				>
					<Icon name={theme.current === 'dark' ? 'sun' : 'moon'} size={18} />
				</button>
			</header>

			<main class="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-28 sm:px-6 lg:px-8 lg:py-8">
				{@render children()}
			</main>
		</div>

		<!-- Mobile tab bar -->
		<nav
			class="border-line bg-bg/90 pb-safe fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t backdrop-blur-md lg:hidden"
		>
			{#each NAV as item (item.href)}
				<a
					href={item.href}
					class="flex flex-col items-center gap-1 pt-2.5 pb-1.5 text-[11px] font-medium transition-colors
					{isActive(item.href) ? 'text-accent' : 'text-ink-subtle'}"
					aria-current={isActive(item.href) ? 'page' : undefined}
				>
					<Icon name={item.icon} size={21} />
					{item.label}
				</a>
			{/each}
		</nav>
	</div>
{/if}

<Toaster />
