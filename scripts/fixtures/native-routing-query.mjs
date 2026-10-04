export function useQuery(options) {
	const state = globalThis.nativeRoutingTest;
	if (options.queryKey[0] !== "session") throw new Error("Protected feature mounted before the role gate");
	state.sessionQuery = options.queryFn;
	return state.session;
}
export const useQueryClient = () => globalThis.nativeAuthTest.queryClient;
export function useMutation(options) {
	return {
		isPending: false,
		async mutate(input) {
			try {
				return await options.mutationFn(input);
			} finally {
				await options.onSettled?.();
			}
		},
	};
}
