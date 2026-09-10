<script lang="ts">
	import Button, { type ButtonVariant, type ButtonSize } from './Button.svelte';

	/** Copy-to-clipboard with the confirmation people look for after clicking. */
	interface Props {
		text: string;
		label?: string;
		copiedLabel?: string;
		variant?: ButtonVariant;
		size?: ButtonSize;
		full?: boolean;
		class?: string;
	}

	let {
		text,
		label = 'Copy',
		copiedLabel = 'Copied',
		variant = 'secondary',
		size = 'md',
		full = false,
		class: className = ''
	}: Props = $props();

	let copied = $state(false);
	let failed = $state(false);
	let timer: ReturnType<typeof setTimeout> | null = null;

	async function copy() {
		failed = false;
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
		} catch {
			// Denied clipboard permission, or an insecure origin: fall back to a
			// selection the user can copy with the keyboard.
			failed = true;
			copied = selectFallback(text);
		}
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			copied = false;
			failed = false;
		}, 2000);
	}

	function selectFallback(value: string): boolean {
		const area = document.createElement('textarea');
		area.value = value;
		area.setAttribute('readonly', '');
		area.style.position = 'fixed';
		area.style.opacity = '0';
		document.body.appendChild(area);
		area.select();
		const ok = document.execCommand?.('copy') ?? false;
		document.body.removeChild(area);
		return ok;
	}
</script>

<Button
	{variant}
	{size}
	{full}
	class={className}
	icon={copied ? 'check' : 'copy'}
	onclick={copy}
	aria-live="polite"
>
	{copied ? copiedLabel : failed ? 'Press Ctrl+C' : label}
</Button>
