import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { BrowserQrScannerService } from "./browserQrScanner";

export function QrScanner({
	onDecode,
}: {
	onDecode: (text: string) => void;
}) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const [error, setError] = useState<string | null>(null);

	// Kept current via effect so the scanner (started once, below) always calls
	// the latest handler without needing to restart the camera on every render.
	const onDecodeRef = useRef(onDecode);
	useEffect(() => {
		onDecodeRef.current = onDecode;
	}, [onDecode]);

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;

		const service = new BrowserQrScannerService();
		let decoded = false;

		void service.start(
			video,
			(text) => {
				// One decode per mount — a held-up code keeps scanning otherwise.
				if (decoded) return;
				decoded = true;
				onDecodeRef.current(text);
			},
			(scanError) => setError(scanError.message),
		);

		return () => service.stop();
	}, []);

	if (error) {
		return (
			<div
				role="alert"
				className="flex flex-col items-center gap-2 py-8 text-center text-brand-danger"
			>
				<AlertTriangle className="size-8" aria-hidden />
				<p className="text-sm">{error}</p>
				<p className="text-xs text-brand-muted">
					Check the browser has camera permission, or use the 6-digit code
					instead.
				</p>
			</div>
		);
	}

	return (
		<video
			ref={videoRef}
			className="aspect-square w-full rounded-card bg-black object-cover"
			muted
			playsInline
		/>
	);
}
