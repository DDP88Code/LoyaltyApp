import { ExternalLink, LogOut } from "lucide-react";
import { BRAND } from "@shared/branding";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSignOut } from "./useSession";

export function NativeWebPortalGate() {
	const signOut = useSignOut();

	return (
		<main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-6">
			<div className="text-center">
				<p className="text-sm tracking-[0.3em] text-brand-secondary uppercase">
					{BRAND.rewardsName}
				</p>
				<h1 className="mt-3 text-3xl">Use the Fives web portal</h1>
				<p className="mt-3 text-sm text-brand-muted">
					This app is for customers. Staff, Admin and Owner accounts use the
					Fives web portal to manage the venue.
				</p>
			</div>
			<Card className="flex flex-col gap-4">
				<p className="text-sm text-brand-muted">
					The portal opens in your browser. Sign in there with your usual account.
				</p>
				{/* Capacitor opens this different origin using Android ACTION_VIEW.
				    Keep the URL fixed: no session, token, return path or other user data. */}
				<a
					href="https://fivessportsbar.app/login"
					rel="noreferrer"
					referrerPolicy="no-referrer"
					className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 text-base font-semibold text-brand-on-primary transition-colors hover:bg-brand-primary-strong"
				>
					<ExternalLink className="size-4" aria-hidden />
					Open Web Portal
				</a>
				<Button
					variant="outline"
					fullWidth
					loading={signOut.isPending}
					leadingIcon={<LogOut className="size-4" aria-hidden />}
					onClick={() => signOut.mutate()}
				>
					Sign Out
				</Button>
				{signOut.isError && (
					<p role="alert" className="text-sm text-brand-danger">
						{signOut.error.message}
					</p>
				)}
			</Card>
		</main>
	);
}
