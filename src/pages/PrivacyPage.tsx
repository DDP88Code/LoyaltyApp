import { Link } from "react-router";
import { PageHeader } from "@/components/ui/PageHeader";

/** Placeholder copy — replace with the real privacy policy before launch. */
export function PrivacyPage() {
	return (
		<main className="mx-auto w-full max-w-2xl p-6">
			<PageHeader title="Privacy policy" />
			<div className="flex flex-col gap-4 text-sm text-brand-muted">
				<p>
					This is a placeholder privacy policy for Fives Rewards. Replace this
					copy with the business&apos;s actual policy before launch.
				</p>
				<p>
					We store your name, email, mobile number and loyalty activity to
					operate the rewards programme. You can request deletion of your
					account from your profile at any time.
				</p>
				<Link to="/app/profile" className="text-brand-secondary underline">
					Back to profile
				</Link>
			</div>
		</main>
	);
}
