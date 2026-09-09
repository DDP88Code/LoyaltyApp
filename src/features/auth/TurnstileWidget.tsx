import { useEffect, useRef, useState } from "react";

type TurnstileRenderOptions = {
	sitekey: string;
	action?: string;
	callback: (token: string) => void;
	"expired-callback": () => void;
	"error-callback": () => void;
};

type TurnstileApi = {
	render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
	remove: (widgetId: string) => void;
	reset: (widgetId: string) => void;
};

declare global {
	interface Window {
		turnstile?: TurnstileApi;
	}
}

const TURNSTILE_SCRIPT_ID = "cf-turnstile-script";
const TURNSTILE_SCRIPT_SRC =
	"https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadTurnstileScript(): Promise<void> {
	if (typeof window === "undefined") {
		return Promise.reject(new Error("Turnstile is unavailable."));
	}

	if (window.turnstile) {
		return Promise.resolve();
	}

	return new Promise((resolve, reject) => {
		const existing = document.getElementById(
			TURNSTILE_SCRIPT_ID,
		) as HTMLScriptElement | null;

		if (existing) {
			existing.addEventListener("load", () => resolve(), { once: true });
			existing.addEventListener(
				"error",
				() => reject(new Error("Turnstile failed to load.")),
				{ once: true },
			);
			return;
		}

		const script = document.createElement("script");
		script.id = TURNSTILE_SCRIPT_ID;
		script.src = TURNSTILE_SCRIPT_SRC;
		script.async = true;
		script.defer = true;
		script.addEventListener("load", () => resolve(), { once: true });
		script.addEventListener(
			"error",
			() => reject(new Error("Turnstile failed to load.")),
			{ once: true },
		);
		document.head.append(script);
	});
}

export function TurnstileWidget({
	siteKey,
	action,
	resetKey,
	onTokenChange,
	onExpired,
}: {
	siteKey: string;
	action: "sign-in" | "sign-up" | "forgot-password";
	resetKey: number;
	onTokenChange: (token: string | null) => void;
	onExpired: () => void;
}) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const widgetIdRef = useRef<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let disposed = false;

		onTokenChange(null);
		setError(null);

		void loadTurnstileScript()
			.then(() => {
				if (disposed) return;
				if (!window.turnstile || !containerRef.current) {
					setError("Verification is unavailable. Please refresh and try again.");
					return;
				}

				widgetIdRef.current = window.turnstile.render(containerRef.current, {
					sitekey: siteKey,
					action,
					callback: (token) => {
						setError(null);
						onTokenChange(token);
					},
					"expired-callback": () => {
						onTokenChange(null);
						onExpired();
					},
					"error-callback": () => {
						onTokenChange(null);
						setError(
							"Verification failed. Please retry the bot check before submitting.",
						);
					},
				});
			})
			.catch(() => {
				if (disposed) return;
				setError("Verification is unavailable. Please refresh and try again.");
			});

		return () => {
			disposed = true;
			if (widgetIdRef.current && window.turnstile) {
				window.turnstile.remove(widgetIdRef.current);
				widgetIdRef.current = null;
			}
		};
	}, [action, onExpired, onTokenChange, resetKey, siteKey]);

	return (
		<div className="space-y-2">
			<div ref={containerRef} />
			{error ? (
				<p className="text-sm text-brand-danger" role="alert">
					{error}
				</p>
			) : null}
		</div>
	);
}