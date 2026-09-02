import { Link } from "react-router";
import { Construction } from "lucide-react";
import { EmptyState } from "@/components/ui/States";
import { PageHeader } from "@/components/ui/PageHeader";

/** Temporary shell for routes that are delivered in a later build phase. */
export function PhasePlaceholderPage({
	title,
	phase,
}: {
	title: string;
	phase: string;
}) {
	return (
		<main className="mx-auto w-full max-w-2xl p-6">
			<PageHeader title={title} subtitle={`Delivered in ${phase}.`} />
			<EmptyState
				icon={<Construction className="size-8" />}
				title="Not built yet"
				description="The foundation is in place. This screen arrives with its build phase."
				action={
					<Link to="/" className="text-sm text-brand-secondary underline">
						Back to start
					</Link>
				}
			/>
		</main>
	);
}
