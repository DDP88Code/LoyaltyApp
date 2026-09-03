export interface KeyValueStore {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

function hasLocalStorage(): boolean {
	try {
		return (
			typeof window !== "undefined" &&
			typeof window.localStorage !== "undefined"
		);
	} catch {
		return false;
	}
}

class BrowserLocalStorageStore implements KeyValueStore {
	getItem(key: string): string | null {
		return window.localStorage.getItem(key);
	}

	setItem(key: string, value: string): void {
		window.localStorage.setItem(key, value);
	}

	removeItem(key: string): void {
		window.localStorage.removeItem(key);
	}
}

class MemoryStore implements KeyValueStore {
	private readonly values = new Map<string, string>();

	getItem(key: string): string | null {
		return this.values.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		this.values.set(key, value);
	}

	removeItem(key: string): void {
		this.values.delete(key);
	}
}

export const appStorage: KeyValueStore = hasLocalStorage()
	? new BrowserLocalStorageStore()
	: new MemoryStore();

export function getStoredJson<T>(key: string): T | null {
	const raw = appStorage.getItem(key);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as T;
	} catch {
		appStorage.removeItem(key);
		return null;
	}
}

export function setStoredJson<T>(key: string, value: T): void {
	appStorage.setItem(key, JSON.stringify(value));
}
