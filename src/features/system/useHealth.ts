import { useQuery } from "@tanstack/react-query";
import type { HealthPayload } from "@shared/api";
import { apiFetch } from "@/lib/api";

export function useHealth() {
	return useQuery({
		queryKey: ["system", "health"],
		queryFn: () => apiFetch<HealthPayload>("/api/health"),
	});
}
