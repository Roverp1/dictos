import { Elysia, t } from "elysia";

export const errorSchema = t.Object({
  type: t.String(),
  title: t.String(),
  status: t.Number(),
  detail: t.String(),
  instance: t.String(),
});

export const validationSchema = t.Composite([
  errorSchema,
  t.Object({
    errors: t.Array(
      t.Object({
        pointer: t.String(),
        reason: t.String(),
      })
    ),
  }),
]);

export const errorsPlugin = new Elysia({ name: "system-errors" })
  .model({
    "errors.standard": errorSchema,
    "errors.validation": validationSchema,
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
      };
    }
  });
