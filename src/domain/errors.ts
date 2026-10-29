import type { ScanStage } from "./types.js";

/**
 * Typed errors. The HTTP layer maps each class to a status code in one place,
 * so client mistakes (4xx) stay distinguishable from provider failures (5xx):
 *
 *   ValidationError / UnknownFixtureError -> 400
 *   EstimateNotFoundError                 -> 404
 *   ProviderError                         -> 502
 *   anything else (a bug)                 -> 500
 */

export interface FieldError {
  field: string;
  message: string;
}

/** The client sent invalid input. */
export class ValidationError extends Error {
  readonly details: FieldError[];

  constructor(details: FieldError[]) {
    super(`Invalid request: ${details.map((d) => `${d.field}: ${d.message}`).join("; ")}`);
    this.name = "ValidationError";
    this.details = details;
  }
}

/** The client asked for a fixture that the provider does not have. */
export class UnknownFixtureError extends Error {
  readonly fixture: string;
  readonly available: string[];

  constructor(fixture: string, available: string[]) {
    super(
      `Unknown fixture "${fixture}". Available fixtures: ${
        available.length > 0 ? available.join(", ") : "(none)"
      }`,
    );
    this.name = "UnknownFixtureError";
    this.fixture = fixture;
    this.available = available;
  }
}

/** A scan stage failed inside the provider. This is NOT the client's fault. */
export class ProviderError extends Error {
  readonly stage: ScanStage;

  constructor(stage: ScanStage, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ProviderError";
    this.stage = stage;
  }
}

export class EstimateNotFoundError extends Error {
  readonly id: string;

  constructor(id: string) {
    super(`Estimate "${id}" was not found`);
    this.name = "EstimateNotFoundError";
    this.id = id;
  }
}
