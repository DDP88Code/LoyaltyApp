import { validator } from "hono/validator";
import { z } from "zod";
import { ApiError } from "@worker/lib/http";

type Target = "json" | "query" | "param";

/**
 * Parses a request with Zod and hands the typed result to `c.req.valid(target)`.
 * Only field names and messages are returned to the caller — never the input,
 * which may contain a password or another secret.
 */
export function validate<S extends z.ZodType>(target: Target, schema: S) {
	return validator(target, (value): z.output<S> => {
		const result = schema.safeParse(value);
		if (!result.success) {
			const flat = z.flattenError(result.error);
			const firstFieldError = Object.values(flat.fieldErrors)
				.flat()
				.find((message): message is string =>
					typeof message === "string" && message.length > 0,
				);
			throw new ApiError(
				"validation_failed",
				// Object-level errors have no field to attach to, so they become the message.
				flat.formErrors[0] ??
					firstFieldError ??
					"Please check the highlighted fields and try again.",
				flat.fieldErrors,
			);
		}
		return result.data;
	});
}
