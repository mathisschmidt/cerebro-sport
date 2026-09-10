<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';
	import { textFieldClasses } from './TextInput.svelte';

	/**
	 * A password field you can read back.
	 *
	 * Worth having everywhere a password is typed, but especially where an admin
	 * sets someone else's — they have to be able to read out what they chose.
	 *
	 * The toggle stays in the tab order: hiding it from the keyboard would make
	 * the only way to check a typo mouse-only.
	 */
	type Props = { value: string; invalid?: boolean; class?: string } & Omit<
		HTMLInputAttributes,
		'value' | 'class' | 'type'
	>;

	let { value = $bindable(), invalid = false, class: className = '', ...rest }: Props = $props();

	let revealed = $state(false);
</script>

<div class="relative {className}">
	<input
		bind:value
		type={revealed ? 'text' : 'password'}
		class={textFieldClasses({ invalid, padding: 'pl-3 pr-11' })}
		{...rest}
	/>
	<button
		type="button"
		class="text-ink-subtle hover:text-ink absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-[10px] transition-colors"
		onclick={() => (revealed = !revealed)}
		aria-label={revealed ? 'Hide password' : 'Show password'}
		aria-pressed={revealed}
		title={revealed ? 'Hide password' : 'Show password'}
	>
		<Icon name={revealed ? 'eyeOff' : 'eye'} size={17} />
	</button>
</div>
