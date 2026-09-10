<script lang="ts" module>
	export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
	export type ButtonSize = 'sm' | 'md' | 'lg';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import Icon, { type IconName } from './Icon.svelte';

	type Props = {
		variant?: ButtonVariant;
		size?: ButtonSize;
		icon?: IconName;
		iconRight?: IconName;
		loading?: boolean;
		full?: boolean;
		children?: Snippet;
		class?: string;
		href?: string;
	} & Omit<HTMLButtonAttributes, 'class'> &
		Omit<HTMLAnchorAttributes, 'class'>;

	let {
		variant = 'secondary',
		size = 'md',
		icon,
		iconRight,
		loading = false,
		full = false,
		children,
		class: className = '',
		href,
		...rest
	}: Props = $props();

	const VARIANTS: Record<ButtonVariant, string> = {
		primary:
			'bg-accent text-accent-ink hover:bg-accent-hover active:brightness-95 border border-transparent font-semibold',
		secondary:
			'bg-surface-raised text-ink border border-line hover:border-line-strong hover:bg-surface-sunken',
		outline: 'bg-transparent text-ink border border-line hover:border-line-strong hover:bg-surface',
		ghost: 'bg-transparent text-ink-muted border border-transparent hover:bg-surface hover:text-ink',
		danger: 'bg-transparent text-danger border border-danger/35 hover:bg-danger/10'
	};

	// Every size clears the 44px touch target on the two larger steps; `sm` is
	// reserved for dense desktop rows.
	const SIZES: Record<ButtonSize, string> = {
		sm: 'h-8 px-2.5 text-[13px] gap-1.5 rounded-lg',
		md: 'h-10 px-3.5 text-sm gap-2 rounded-[10px]',
		lg: 'h-12 px-5 text-base gap-2 rounded-xl'
	};

	const iconSize = $derived(size === 'lg' ? 20 : size === 'md' ? 18 : 16);
	const classes = $derived(
		[
			'inline-flex items-center justify-center whitespace-nowrap transition-colors select-none',
			'disabled:opacity-45 disabled:pointer-events-none',
			VARIANTS[variant],
			SIZES[size],
			full ? 'w-full' : '',
			className
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

{#snippet content()}
	{#if loading}
		<span
			class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
		></span>
	{:else if icon}
		<Icon name={icon} size={iconSize} filled={icon === 'play'} />
	{/if}
	{@render children?.()}
	{#if iconRight && !loading}
		<Icon name={iconRight} size={iconSize} />
	{/if}
{/snippet}

{#if href}
	<a {href} class={classes} {...rest as HTMLAnchorAttributes}>
		{@render content()}
	</a>
{:else}
	<button class={classes} disabled={loading || rest.disabled} {...rest as HTMLButtonAttributes}>
		{@render content()}
	</button>
{/if}
