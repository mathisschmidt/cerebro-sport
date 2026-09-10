import { browser } from '$app/environment';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'cerebro-sport:theme';

/** Reads whatever the inline script in app.html already applied. */
function initial(): Theme {
	if (!browser) return 'dark';
	return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

class ThemeStore {
	current = $state<Theme>(initial());

	set(theme: Theme): void {
		this.current = theme;
		if (!browser) return;
		document.documentElement.dataset.theme = theme;
		try {
			localStorage.setItem(STORAGE_KEY, theme);
		} catch {
			// Private mode: the theme simply will not persist.
		}
	}

	toggle(): void {
		this.set(this.current === 'dark' ? 'light' : 'dark');
	}
}

export const theme = new ThemeStore();
