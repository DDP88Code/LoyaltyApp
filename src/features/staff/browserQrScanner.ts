import QrScannerLib from "qr-scanner";
import type { ScannerService } from "./scanner";

/** `qr-scanner` uses the native BarcodeDetector where available and falls back to a worker-based decoder. */
export class BrowserQrScannerService implements ScannerService {
	private instance: QrScannerLib | null = null;

	async start(
		video: HTMLVideoElement,
		onDecode: (text: string) => void,
		onError: (error: Error) => void,
	): Promise<void> {
		this.instance = new QrScannerLib(
			video,
			(result) => onDecode(result.data),
			{
				preferredCamera: "environment",
				highlightScanRegion: true,
				highlightCodeOutline: true,
			},
		);

		try {
			await this.instance.start();
		} catch (error) {
			onError(
				error instanceof Error
					? error
					: new Error("Could not access the camera."),
			);
		}
	}

	stop(): void {
		this.instance?.stop();
		this.instance?.destroy();
		this.instance = null;
	}
}
