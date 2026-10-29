import { z } from "zod";
import { ValidationError, type FieldError } from "../domain/errors.js";
import type { CreateEstimateInput } from "../services/EstimateService.js";

/**
 * Validation of POST /estimates, done at the API edge so that invalid input never
 * reaches the service: the provider is not called and nothing is persisted.
 *
 * Rules (all enforced here, none coerced: the string "12" is NOT accepted as 12):
 *  - project: a string with at least one non-space character (surrounding spaces are trimmed)
 *  - floors:  a positive integer
 *  - fixture: a string with at least one non-space character (surrounding spaces are trimmed)
 * "Fixture must refer to an available fixture" is checked by the service, which asks the provider.
 *
 * Upper bounds are my own addition, not part of the exercise statement. They keep
 * inputs sane and guarantee that prices stay exact integers.
 */
export const MAX_FLOORS = 1000;
export const MAX_PROJECT_LENGTH = 200;
export const MAX_FIXTURE_LENGTH = 100;

function describeType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function textField(maxLength: number) {
  return z
    .string({
      error: (issue) =>
        issue.input === undefined
          ? "is required"
          : `must be a string (received ${describeType(issue.input)})`,
    })
    .trim()
    .min(1, "must not be empty")
    .max(maxLength, `must be at most ${maxLength} characters`);
}

const floorsSchema = z
  .number({
    error: (issue) =>
      issue.input === undefined
        ? "is required"
        : `must be a positive integer (received ${describeType(issue.input)})`,
  })
  .int("must be a positive integer")
  .positive("must be a positive integer")
  .max(MAX_FLOORS, `must be at most ${MAX_FLOORS}`);

// Unknown extra keys in the body are ignored (zod strips them).
const createEstimateSchema = z.object({
  project: textField(MAX_PROJECT_LENGTH),
  floors: floorsSchema,
  fixture: textField(MAX_FIXTURE_LENGTH),
});

/** Returns clean, typed input or throws a ValidationError listing every problem found. */
export function parseCreateEstimateRequest(body: unknown): CreateEstimateInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ValidationError([
      {
        field: "body",
        message: "must be a JSON object (send it with Content-Type: application/json)",
      },
    ]);
  }

  const result = createEstimateSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError(toFieldErrors(result.error.issues));
  }
  return result.data;
}

function toFieldErrors(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): FieldError[] {
  const seen = new Set<string>();
  const errors: FieldError[] = [];

  for (const issue of issues) {
    const field = issue.path.map(String).join(".") || "body";
    const key = `${field}|${issue.message}`;
    // Two checks can fail with the same text (e.g. -1.5 is neither integer nor positive).
    if (!seen.has(key)) {
      seen.add(key);
      errors.push({ field, message: issue.message });
    }
  }

  return errors;
}
