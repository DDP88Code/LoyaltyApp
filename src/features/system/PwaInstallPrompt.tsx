import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandaloneMode(): boolean {
	if (typeof window === "undefined") return false;
	const media = window.matchMedia("(display-mode: standalone)").matches;
	const iosStandalone =
		typeof navigator !== "undefined" &&
		Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
	return media || iosStandalone;
}

function isIosDevice(): boolean {
	if (typeof navigator === "undefined") return false;
	return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function PwaInstallPrompt() {
	const [deferredPrompt, setDeferredPrompt] =
		useState<BeforeInstallPromptEvent | null>(null);
	const [dismissed, setDismissed] = useState(false);
	const [installing, setInstalling] = useState(false);

	const standalone = useMemo(isStandaloneMode, []);
	const ios = useMemo(isIosDevice, []);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const onBeforeInstallPrompt = (event: Event) => {
			event.preventDefault();
			setDeferredPrompt(event as BeforeInstallPromptEvent);
		};

		const onAppInstalled = () => {
			setDeferredPrompt(null);
			setDismissed(true);
		};

		window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
		window.addEventListener("appinstalled", onAppInstalled);

		return () => {
			window.removeEventListener(
				"beforeinstallprompt",
				onBeforeInstallPrompt,
			);
			window.removeEventListener("appinstalled", onAppInstalled);
		};
	}, []);

	if (standalone || dismissed) return null;

	if (deferredPrompt) {
		return (
			<div className="fixed right-4 bottom-6 left-4 z-40 mx-auto max-w-md rounded-xl border border-brand-border bg-brand-surface-raised p-3 shadow-xl">
				<p className="text-sm font-semibold">Install Fives Rewards</p>
				<p className="mt-1 text-xs text-brand-muted">
					Install for faster launch and a full-screen app experience.
				</p>
				<div className="mt-3 flex gap-2">
					<Button
						size="sm"
						fullWidth
						loading={installing}
						leadingIcon={<Download className="size-4" aria-hidden />}
						onClick={async () => {
							if (!deferredPrompt) return;
							setInstalling(true);
							await deferredPrompt.prompt();
							await deferredPrompt.userChoice;
							setDeferredPrompt(null);
							setInstalling(false);
						}}
					>
						Install app
					</Button>
					<Button size="sm" variant="outline" onClick={() => setDismissed(true)}>
						Not now
					</Button>
				</div>
			</div>
		);
	}

	if (ios) {
		return (
			<div className="fixed right-4 bottom-6 left-4 z-40 mx-auto max-w-md rounded-xl border border-brand-border bg-brand-surface-raised p-3 shadow-xl">
				<p className="text-sm font-semibold">Install Fives Rewards</p>
				<p className="mt-1 text-xs text-brand-muted">
					On iPhone/iPad, use Share then Add to Home Screen.
				</p>
				<div className="mt-3">
					<Button size="sm" variant="outline" fullWidth onClick={() => setDismissed(true)}>
						Dismiss
					</Button>
				</div>
			</div>
		);
	}

	return null;
}
