import { Link } from "react-router";
import { EmptyState } from "@/components/ui/States";

export function NotFoundPage() {
	return (
		<main className="mx-auto flex min-h-dvh w-full max-w-md items-center p-6">
			<EmptyState
				title="Page not found"
				description="That page does not exist."
				action={
					<Link to="/" className="text-sm text-brand-secondary underline">
						Back to start
					</Link>
				}
			/>
		</main>
	);
}
