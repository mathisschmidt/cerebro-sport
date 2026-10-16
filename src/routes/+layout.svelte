<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import Icon, { type IconName } from '$components/ui/Icon.svelte';
	import Toaster from '$components/ui/Toaster.svelte';
	import Button from '$components/ui/Button.svelte';
	import ConfirmDialog from '$components/ui/ConfirmDialog.svelte';
	import SyncStatus from '$components/shared/SyncStatus.svelte';
	import { theme } from '$client/theme.svelte.ts';
	import { authClient } from '$client/auth.ts';
	import {
		connectivity,
		outbox,
		refreshOffline,
		resetOffline,
		snapshot,
		startOffline,
		updates
	} from '$client/offline/index.ts';
	import { USER_ROLE_LABEL } from '$domain/models/user.ts';
	import { formatDateTimeLabel } from '$domain/services/date.ts';
	import { goto, invalidateAll } from '$app/navigation';
	import { onMount, type Snippet } from 'svelte';
	import type { LayoutData } from './$types.ts';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	let signingOut = $state(false);
	let unsyncedSignOutOpen = $state(false);

	// Offline training follows the signed-in account: its runs, its queue, its copy.
	$effect(() => {
		if (data.user) void startOffline(data.user.id);
	});

	onMount(() => {
		// Runs synced: the pages showing history and metrics are stale now. Never
		// on the run page, whose load would see its own logged steps as a left run.
		const stopDelivered = outbox.onDelivered(() => {
			if (!page.url.pathname.startsWith('/run/')) void invalidateAll();
		});
		const stopReconnect = connectivity.onReconnect(refreshOffline);
		const onVisible = () => {
			if (document.visibilityState === 'visible') refreshOffline();
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			stopDelivered();
			stopReconnect();
			document.removeEventListener('visibilitychange', onVisible);
		};
	});

	/** Runs not on the server yet would be lost with the device's data: deliver, or ask first. */
	async function signOut() {
		await outbox.flush();
		if (outbox.pending + outbox.rejected > 0) {
			unsyncedSignOutOpen = true;
			return;
		}
		await completeSignOut();
	}

	const unsyncedMessage = $derived.by(() => {
		const count = outbox.pending + outbox.rejected;
		const runs = count === 1 ? '1 run' : `${count} runs`;
		return `${runs} from this device ${count === 1 ? 'has' : 'have'} not reached the server yet. Signing out deletes ${count === 1 ? 'it' : 'them'} for good — get back online first to keep ${count === 1 ? 'it' : 'them'}.`;
	});

	async function completeSignOut() {
		signingOut = true;
		await resetOffline();
		await authClient.signOut();
		await goto('/login', { invalidateAll: true });
		signingOut = false;
	}

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

	/**
	 * The runner takes the whole screen, and the sign-in screens have no app to
	 * navigate yet — both render without any chrome.
	 */
	const running = $derived(page.url.pathname.startsWith('/run/'));
	const immersive = $derived(
		running ||
			page.url.pathname === '/login' ||
			page.url.pathname === '/register'
	);
</script>

<svelte:head>
	<title>Cerebro Sport — Training</title>
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
					Cerebro&nbsp;Sport
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

			<div class="mt-auto flex flex-col gap-0.5">
				{#if data.user?.role === 'admin'}
					<a
						href="/admin"
						class="flex h-10 items-center gap-3 rounded-[10px] px-3 text-sm font-medium transition-colors
						{isActive('/admin')
							? 'bg-accent-soft text-accent'
							: 'text-ink-muted hover:bg-surface hover:text-ink'}"
						aria-current={isActive('/admin') ? 'page' : undefined}
					>
						<Icon name="settings" size={18} />
						Admin
					</a>
				{/if}

				<SyncStatus class="mx-3 mb-2 self-start" />
				<button
					type="button"
					class="text-ink-muted hover:bg-surface hover:text-ink flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-sm font-medium transition-colors"
					onclick={() => theme.toggle()}
				>
					<Icon name={theme.current === 'dark' ? 'sun' : 'moon'} size={18} />
					{theme.current === 'dark' ? 'Light mode' : 'Dark mode'}
				</button>

				{#if data.user}
					<div class="border-line mt-1 flex items-center gap-1 border-t pt-2">
						<a
							href="/account"
							class="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[10px] px-1 transition-colors
							{isActive('/account') ? 'bg-accent-soft' : 'hover:bg-surface'}"
							aria-current={isActive('/account') ? 'page' : undefined}
							title="Account"
						>
							<span
								class="bg-surface-sunken text-ink-muted grid size-8 shrink-0 place-items-center rounded-full text-[12px] font-semibold uppercase"
							>
								{data.user.username.slice(0, 2)}
							</span>
							<span class="min-w-0 flex-1">
								<span class="text-ink block truncate text-[13px] font-medium">
									{data.user.username}
								</span>
								<span class="text-ink-subtle block text-[11px]">
									{USER_ROLE_LABEL[data.user.role]}
								</span>
							</span>
						</a>
						<button
							type="button"
							class="text-ink-subtle hover:text-ink hover:bg-surface grid size-8 shrink-0 place-items-center rounded-lg transition-colors disabled:opacity-50"
							onclick={signOut}
							disabled={signingOut}
							aria-label="Sign out"
							title="Sign out"
						>
							<Icon name="signOut" size={17} />
						</button>
					</div>
				{/if}
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
					<span class="text-sm font-semibold">Cerebro&nbsp;Sport</span>
				</a>
				<div class="-mr-2 flex items-center">
					<SyncStatus class="mr-1" />
					{#if data.user}
						<a
							href="/account"
							class="grid size-9 place-items-center rounded-lg {isActive('/account')
								? 'text-accent'
								: 'text-ink-muted hover:text-ink'}"
							aria-label="Account"
						>
							<Icon name="user" size={18} />
						</a>
					{/if}
					{#if data.user?.role === 'admin'}
						<a
							href="/admin"
							class="grid size-9 place-items-center rounded-lg {isActive('/admin')
								? 'text-accent'
								: 'text-ink-muted hover:text-ink'}"
							aria-label="Admin"
						>
							<Icon name="settings" size={18} />
						</a>
					{/if}
					<button
						type="button"
						class="text-ink-muted hover:text-ink grid size-9 place-items-center rounded-lg"
						onclick={() => theme.toggle()}
						aria-label="Switch theme"
					>
						<Icon name={theme.current === 'dark' ? 'sun' : 'moon'} size={18} />
					</button>
					{#if data.user}
						<button
							type="button"
							class="text-ink-muted hover:text-ink grid size-9 place-items-center rounded-lg disabled:opacity-50"
							onclick={signOut}
							disabled={signingOut}
							aria-label="Sign out"
						>
							<Icon name="signOut" size={18} />
						</button>
					{/if}
				</div>
			</header>

			<main class="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-28 sm:px-6 lg:px-8 lg:py-8">
				{#if updates.ready}
					<div
						class="border-accent/40 bg-accent-soft mb-4 flex items-center gap-3 rounded-xl border px-3.5 py-2.5"
						role="status"
					>
						<span class="text-ink min-w-0 flex-1 text-[13px]">A new version of the app is ready.</span>
						<Button variant="primary" size="sm" onclick={() => updates.apply()}>Reload</Button>
					</div>
				{/if}
				{#if !connectivity.online}
					<div
						class="border-line bg-surface-sunken text-ink-muted mb-4 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px]"
						role="status"
					>
						<span class="text-ink-subtle mt-0.5 shrink-0"><Icon name="alert" size={15} /></span>
						<span>
							You are offline. You can still run a session — it syncs when you are back.
							{#if snapshot.current}
								Everything else shows what was saved {formatDateTimeLabel(snapshot.current.generatedAt)}
								and cannot be changed until then.
							{:else}
								Everything else shows what was last loaded and cannot be changed until then.
							{/if}
						</span>
					</div>
				{/if}
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

<ConfirmDialog
	bind:open={unsyncedSignOutOpen}
	title="Sign out with runs not synced?"
	message={unsyncedMessage}
	confirmLabel="Sign out anyway"
	danger
	onconfirm={completeSignOut}
/>

<Toaster />
