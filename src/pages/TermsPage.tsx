import { Link } from "react-router";
import { PageHeader } from "@/components/ui/PageHeader";

/** Placeholder copy — replace with the real terms before launch. */
export function TermsPage() {
	return (
		<main className="mx-auto w-full max-w-2xl p-6">
			<PageHeader title="Terms of use" />
			<div className="flex flex-col gap-4 text-sm text-brand-muted">
				<p>
					These are placeholder terms of use for Fives Rewards, the loyalty
					programme for Fives Pub &amp; Grill. Replace this copy with the
					business&apos;s actual terms before launch.
				</p>
				<p>
					Rewards are issued at the sole discretion of Fives Pub &amp; Grill
					and have no cash value. Fraudulent use of the loyalty programme may
					result in account suspension.
				</p>
				<Link to="/app/profile" className="text-brand-secondary underline">
					Back to profile
				</Link>
			</div>
		</main>
	);
}
