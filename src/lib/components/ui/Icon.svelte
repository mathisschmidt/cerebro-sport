<script lang="ts" module>
	/**
	 * Inline icon set. Keeping the paths here avoids an icon dependency and lets
	 * every icon inherit `currentColor` and the surrounding font size.
	 */
	export const ICONS = {
		home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
		library: '<rect x="3" y="4" width="7" height="16" rx="1.5"/><rect x="14" y="4" width="7" height="16" rx="1.5"/>',
		chart: '<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>',
		calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/>',
		dumbbell: '<path d="M6.5 6.5v11M3 9v6M17.5 6.5v11M21 9v6M6.5 12h11"/>',
		flame: '<path d="M12 3s5 4.2 5 9a5 5 0 0 1-10 0c0-1.6.6-2.9 1.4-4 .2 1.2.9 2 1.8 2.2C9.6 8 12 6.4 12 3Z"/>',
		plus: '<path d="M12 5v14M5 12h14"/>',
		minus: '<path d="M5 12h14"/>',
		close: '<path d="M18 6 6 18M6 6l12 12"/>',
		check: '<path d="m5 13 4 4L19 7"/>',
		play: '<path d="M7 4.5 19 12 7 19.5z"/>',
		pause: '<path d="M8 5v14M16 5v14"/>',
		skip: '<path d="M5 4.5 15 12 5 19.5zM19 5v14"/>',
		trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
		pencil: '<path d="M4 20h4L20 8l-4-4L4 16z"/>',
		search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
		clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
		timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4M9 2h6M18.5 6.5 20 5"/>',
		repeat: '<path d="M4 9V7a2 2 0 0 1 2-2h11"/><path d="m14 2 3 3-3 3"/><path d="M20 15v2a2 2 0 0 1-2 2H7"/><path d="m10 22-3-3 3-3"/>',
		chevronDown: '<path d="m6 9 6 6 6-6"/>',
		chevronRight: '<path d="m9 6 6 6-6 6"/>',
		chevronLeft: '<path d="m15 6-6 6 6 6"/>',
		chevronUp: '<path d="m6 15 6-6 6 6"/>',
		arrowRight: '<path d="M4 12h16M14 6l6 6-6 6"/>',
		arrowDown: '<path d="M12 4v16M6 14l6 6 6-6"/>',
		arrowUp: '<path d="M12 20V4M6 10l6-6 6 6"/>',
		sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
		moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
		layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
		target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
		note: '<path d="M6 3h9l5 5v13H6z"/><path d="M15 3v5h5M9 13h6M9 17h4"/>',
		alert: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17.5v.01"/>',
		copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
		grip: '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/>',
		history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 8v4.5l3 1.8"/>',
		zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
		settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.5 15a2 2 0 1 1 0-4 1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.5a2 2 0 1 1 4 0 1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7 2 2 0 1 1 0 4 1.6 1.6 0 0 0-1.2.9Z"/>'
	} as const;

	export type IconName = keyof typeof ICONS;
</script>

<script lang="ts">
	interface Props {
		name: IconName;
		size?: number | string;
		/** Filled icons (play, flame) read better without a stroke. */
		filled?: boolean;
		class?: string;
	}

	let { name, size = 20, filled = false, class: className = '' }: Props = $props();
</script>

<svg
	class={className}
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill={filled ? 'currentColor' : 'none'}
	stroke={filled ? 'none' : 'currentColor'}
	stroke-width="1.75"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false">{@html ICONS[name]}</svg
>
