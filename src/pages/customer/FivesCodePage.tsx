import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useGenerateLoyaltyCode } from "@/features/customer/api";
import { useNotificationProvider } from "@/features/system/notifications";
import { useOnlineStatus } from "@/features/system/useOnlineStatus";

function formatOtp(otp: string): string {
	return `${otp.slice(0, 3)} ${otp.slice(3)}`;
}

function formatCountdown(seconds: number): string {
	const minutes = Math.floor(seconds / 60)
		.toString()
		.padStart(2, "0");
	const rest = (seconds % 60).toString().padStart(2, "0");
	return `${minutes}:${rest}`;
}

/** Ticks once a second against a fixed deadline rather than counting down a local number. */
function useSecondsRemaining(expiresAt: string | undefined): number {
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		if (!expiresAt) return;
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, [expiresAt]);

	if (!expiresAt) return 0;
	return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
}

/** Generation is server-side (Phase 6): secure OTP + QR token, hashed at rest. */
export function FivesCodePage() {
	const isOnline = useOnlineStatus();
	const notifications = useNotificationProvider();
	const generate = useGenerateLoyaltyCode();
	const requestedOnce = useRef(false);
	const secondsRemaining = useSecondsRemaining(generate.data?.expiresAt);
	const expired = Boolean(generate.data) && secondsRemaining <= 0;

	const requestCode = () => {
		if (!isOnline) return;
		generate.mutate(undefined, {
			onSuccess: (payload) => {
				void notifications.sendLoyaltyCode({ expiresAt: payload.expiresAt });
			},
		});
	};

	useEffect(() => {
		if (requestedOnce.current || !isOnline) return;
		requestedOnce.current = true;
		requestCode();
		// One-time on mount; the mutation object is excluded so this never re-fires.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOnline]);

	return (
		<div className="flex flex-col items-center gap-5 p-5 text-center">
			<PageHeader title="My Fives Code" />

			{!isOnline && (
				<p className="text-sm text-brand-danger">
					Internet is required to generate and refresh your loyalty code.
				</p>
			)}

			{generate.isPending && <LoadingState label="Generating your code…" />}

			{generate.isError && (
				<ErrorState
					description={generate.error.message}
					onRetry={requestCode}
				/>
			)}

			{generate.data && !expired && (
				<>
					<div className="rounded-card bg-white p-4">
						<QRCode value={generate.data.qrToken} size={200} />
					</div>
					<p className="text-3xl font-semibold tracking-[0.2em]">
						{formatOtp(generate.data.otp)}
					</p>
					<p className="text-sm text-brand-muted">
						Expires in {formatCountdown(secondsRemaining)}
					</p>
					<p className="max-w-xs text-sm text-brand-muted">
						Show this QR code to your waiter or give them the 6-digit code.
					</p>
				</>
			)}

			{expired && (
				<p className="text-sm text-brand-danger">
					This code has expired. Generate a new one to continue.
				</p>
			)}

			{generate.data && (
				<Button
					variant="outline"
					loading={generate.isPending}
					disabled={!isOnline}
					leadingIcon={<RefreshCw className="size-4" aria-hidden />}
					onClick={requestCode}
				>
					Generate New Code
				</Button>
			)}
		</div>
	);
}
