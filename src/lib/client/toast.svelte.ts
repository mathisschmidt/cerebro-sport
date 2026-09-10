/** Transient feedback for actions that do not navigate. */

export type ToastTone = 'info' | 'success' | 'error';

export interface Toast {
	id: number;
	tone: ToastTone;
	message: string;
}

const DURATION_MS = 4000;

class ToastStore {
	items = $state<Toast[]>([]);
	#nextId = 1;

	push(message: string, tone: ToastTone = 'info'): void {
		const id = this.#nextId++;
		this.items = [...this.items, { id, tone, message }];
		setTimeout(() => this.dismiss(id), DURATION_MS);
	}

	success(message: string): void {
		this.push(message, 'success');
	}

	error(message: string): void {
		this.push(message, 'error');
	}

	dismiss(id: number): void {
		this.items = this.items.filter((toast) => toast.id !== id);
	}
}

export const toasts = new ToastStore();
