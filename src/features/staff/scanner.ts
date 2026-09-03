/**
 * Scanning behind an interface so the browser implementation (below) can later
 * be swapped for a Capacitor/native barcode scanner without touching call sites.
 */
export interface ScannerService {
	/** Resolves once the camera is live; `onDecode` fires for every scan. */
	start(
		video: HTMLVideoElement,
		onDecode: (text: string) => void,
		onError: (error: Error) => void,
	): Promise<void>;
	stop(): void;
}
