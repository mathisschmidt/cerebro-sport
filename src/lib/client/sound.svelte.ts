import { browser } from '$app/environment';

/**
 * Volume of the runner's audio cues — the countdown beeps and the tone at each
 * step change. Per device rather than per account: a phone on a gym floor and a
 * laptop at a desk want different levels.
 */

const STORAGE_KEY = 'cerebro-sport:alert-volume';

/** 0–100. 60 reproduces the level the cues always had. */
export const DEFAULT_VOLUME = 60;

/** Peak gain at 100%. A lone sine wave stays clean well below 1. */
const MAX_GAIN = 0.5;

function initial(): number {
	if (!browser) return DEFAULT_VOLUME;
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		const value = stored === null ? NaN : Number(stored);
		return Number.isFinite(value) ? clamp(value) : DEFAULT_VOLUME;
	} catch {
		return DEFAULT_VOLUME;
	}
}

function clamp(value: number): number {
	return Math.min(100, Math.max(0, Math.round(value)));
}

class SoundStore {
	volume = $state(initial());
	/** The level to come back to when unmuting. */
	#beforeMute = DEFAULT_VOLUME;

	get muted(): boolean {
		return this.volume === 0;
	}

	/**
	 * Gain for a tone's peak. Squared, because loudness is perceived roughly
	 * logarithmically: a linear slider would do all its work in the first third.
	 */
	get gain(): number {
		return MAX_GAIN * (this.volume / 100) ** 2;
	}

	toggleMute(): void {
		if (this.muted) {
			this.set(this.#beforeMute);
		} else {
			this.#beforeMute = this.volume;
			this.set(0);
		}
	}

	set(volume: number): void {
		this.volume = clamp(volume);
		if (!browser) return;
		try {
			localStorage.setItem(STORAGE_KEY, String(this.volume));
		} catch {
			// Private mode: the level simply will not persist.
		}
	}
}

export const sound = new SoundStore();
