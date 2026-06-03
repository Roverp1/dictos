import { Elysia, t } from "elysia";

export const errorResponseSchema = t.Object({
  // for autocompletion
  type: t.Unsafe<(string & {}) | "about:blank">(
    t.Union([t.String(), t.Literal("about:blank")])
  ),
  title: t.String(),
  status: t.Number(),
  detail: t.String(),
  instance: t.String(),
});

export const validationErrorResponseSchema = t.Composite([
  errorResponseSchema,
  t.Object({
    errors: t.Array(
      t.Object({
        pointer: t.String(),
        reason: t.String(),
      })
    ),
  }),
]);

export type ErrorResponse = typeof errorResponseSchema.static;
export type ValidationErrorResponse =
  typeof validationErrorResponseSchema.static;

export const errorsPlugin = new Elysia({ name: "system-errors" })
  .model({
    "errors.standard": errorResponseSchema,
    "errors.validation": validationErrorResponseSchema,
  })
  .onError({ as: "global" }, ({ code, error, set, request }) => {
    console.error("Error:", error);

    if (code === "VALIDATION") {
      set.status = 422;

      const mappedErrors = error.all.map((e) => {
        const customMessage = e.schema.error;
        return {
          pointer: `#${e.path}`,
          reason: customMessage || e.message || e.summary || "Invalid value",
        };
      });

      return {
        type: "about:blank",
        title: "Unprocessable Content",
        status: 422,
        detail: "The request body failed to pass validaiton constraints.",
        instance: new URL(request.url).pathname,
        errors: mappedErrors,
      } as ValidationErrorResponse;
    }

    console.error("Unhandled server error:", error);
    set.status = 500;
    return {
      type: "about:blank",
      title: "Internal Server Error",
      status: 500,
      detail: "An unexpected error occurred",
      instance: new URL(request.url).pathname,
    } as ErrorResponse;
  });
