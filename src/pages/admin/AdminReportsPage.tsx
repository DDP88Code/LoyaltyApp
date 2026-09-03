import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";

export function AdminReportsPage() {
	return (
		<main className="mx-auto w-full max-w-4xl p-6">
			<PageHeader
				title="Reports"
				subtitle="Reports are fed by dashboard, transactions, and audit sources."
			/>
			<EmptyState
				icon={<BarChart3 className="size-8" />}
				title="Report exports arrive in a later phase"
				description="Phase 11 focuses on live admin analysis and traceability across customers, transactions, and rewards."
			/>
		</main>
	);
}
