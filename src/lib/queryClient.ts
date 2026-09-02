import { QueryClient } from "@tanstack/react-query";
import { ApiClientError } from "./api";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			refetchOnWindowFocus: false,
			retry: (failureCount, error) => {
				// Auth/permission failures will never succeed on retry.
				if (
					error instanceof ApiClientError &&
					["unauthenticated", "forbidden", "not_found"].includes(error.code)
				) {
					return false;
				}
				return failureCount < 2;
			},
		},
		mutations: { retry: false },
	},
});
