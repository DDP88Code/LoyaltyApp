import { Link } from "react-router";
import { BRAND } from "@shared/branding";
import { PageHeader } from "@/components/ui/PageHeader";

export function TermsPage() {
	return (
		<main className="mx-auto w-full max-w-2xl p-6">
			<PageHeader title="Terms of use" />
			<div className="flex flex-col gap-4 text-sm text-brand-muted">
				<p>
					These terms apply to your use of {BRAND.rewardsName} provided by {BRAND.fullName}.
					 By joining or using the service, you agree to these terms.
				</p>
				<p>
					Rewards, vouchers, and promotions are subject to eligibility rules,
					validity dates, and expiry periods shown in the app. They are not
					transferable, may not be exchanged for cash, and may be limited,
					changed, paused, or withdrawn at any time where permitted by law.
				</p>
				<p>
					Menu items, pricing, offers, and promotional availability can vary by
					time, stock, and operational conditions. Information in the app is
					provided in good faith but may change without prior notice.
				</p>
				<p>
					Abuse, fraud, manipulation of rewards, unauthorized account access,
					or misuse of promotional mechanics may result in benefit reversal,
					account restrictions, suspension, or closure.
				</p>
				<p>
					These terms are governed by the laws of South Africa.
				</p>
				<p>
					Questions or support: {" "}
					<a className="text-brand-secondary underline" href={`mailto:${BRAND.support.email}`}>
						{BRAND.support.email}
					</a>{" "}
					or {" "}
					<a className="text-brand-secondary underline" href={BRAND.website} target="_blank" rel="noreferrer">
						{BRAND.website}
					</a>
				</p>
				<Link to="/app/profile" className="text-brand-secondary underline">
					Back to profile
				</Link>
			</div>
		</main>
	);
}
