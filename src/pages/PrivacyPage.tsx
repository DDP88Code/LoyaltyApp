import { Link } from "react-router";
import { BRAND } from "@shared/branding";
import { PageHeader } from "@/components/ui/PageHeader";

export function PrivacyPage() {
	return (
		<main className="mx-auto w-full max-w-2xl p-6">
			<PageHeader title="Privacy policy" />
			<div className="flex flex-col gap-4 text-sm text-brand-muted">
				<p>
					This policy explains how {BRAND.fullName} collects, uses, and protects
					personal information for {BRAND.rewardsName}.
				</p>
				<p>
					We collect account and rewards data such as name, email address,
					mobile number (if provided), birthday (if provided), profile
					preferences, loyalty transactions, rewards, vouchers, and redemption
					history. We use this information to operate your account, deliver
					rewards services, prevent abuse, and provide support.
				</p>
				<p>
					Marketing messages are optional and controlled by your profile
					preferences. Account notifications are used for service operations,
					such as reward status and important account updates.
				</p>
				<p>
					Web push notifications are optional on supported devices and can be
					enabled or disabled in your profile. Device-level browser settings
					also apply.
				</p>
				<p>
					We do not sell your personal information. We share data only where
					needed to run the service, comply with legal obligations, or protect
					our platform and users.
				</p>
				<p>
					You may request account deletion from your profile. When deletion is
					requested, account data is removed according to system behavior, while
					some records may be retained where required by law, to resolve
					disputes, or to investigate fraud and abuse.
				</p>
				<p>
					In line with POPIA, you may request access to, correction of, or
					deletion of your personal information, and may object to certain
					processing where applicable. Contact us at {" "}
					<a className="text-brand-secondary underline" href={`mailto:${BRAND.support.email}`}>
						{BRAND.support.email}
					</a>{" "}
					or visit {" "}
					<a className="text-brand-secondary underline" href={BRAND.website} target="_blank" rel="noreferrer">
						{BRAND.website}
					</a>
					.
				</p>
				<Link to="/app/profile" className="text-brand-secondary underline">
					Back to profile
				</Link>
			</div>
		</main>
	);
}
