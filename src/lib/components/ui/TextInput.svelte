<script lang="ts" module>
	/**
	 * The canonical text-field styling.
	 *
	 * Exported so a field that needs different markup around the input —
	 * `PasswordInput` and its reveal button — stays visually identical without
	 * copying the classes. Horizontal padding is a parameter rather than part of
	 * the base, so a caller adding a trailing control does not have to fight
	 * `px-3` with an `!important`.
	 */
	export function textFieldClasses(
		options: { invalid?: boolean; padding?: string; extra?: string } = {}
	): string {
		const { invalid = false, padding = 'px-3', extra = '' } = options;
		return [
			'bg-surface-sunken text-ink placeholder:text-ink-subtle h-10 w-full rounded-[10px]',
			'border text-sm transition-colors outline-none',
			padding,
			invalid ? 'border-danger' : 'border-line focus:border-accent',
			extra
		]
			.filter(Boolean)
			.join(' ');
	}
</script>

<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	type Props = { value: string | number; invalid?: boolean; class?: string } & Omit<
		HTMLInputAttributes,
		'value' | 'class'
	>;

	let { value = $bindable(), invalid = false, class: className = '', ...rest }: Props = $props();
</script>

<input bind:value class={textFieldClasses({ invalid, extra: className })} {...rest} />
