import type { ErrorRequestHandler, RequestHandler } from "express";
import {
  EstimateNotFoundError,
  ProviderError,
  UnknownFixtureError,
  ValidationError,
  type FieldError,
} from "../domain/errors.js";
import type { ScanStage } from "../domain/types.js";

/** Every error response has this shape, so clients can always read `error.code`. */
export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: FieldError[];
    stage?: ScanStage;
  };
}

export interface HttpFailure {
  status: number;
  body: ErrorBody;
}

/** The only thing the HTTP layer needs from a logger. `console` satisfies it. */
export interface Logger {
  error(...args: unknown[]): void;
}

/**
 * The single place where errors become HTTP responses:
 *
 *   ValidationError, UnknownFixtureError  -> 400  client mistake
 *   EstimateNotFoundError                 -> 404  client mistake
 *   ProviderError                         -> 502  the scan provider failed (not the client's fault)
 *   malformed / oversized body            -> 400 / 413
 *   anything else                         -> 500  a bug; details are logged, never sent to the client
 */
export function toHttpFailure(error: unknown): HttpFailure {
  if (error instanceof ValidationError) {
    return failure(400, "validation_error", "Request validation failed", { details: error.details });
  }
  if (error instanceof UnknownFixtureError) {
    return failure(400, "unknown_fixture", error.message);
  }
  if (error instanceof EstimateNotFoundError) {
    return failure(404, "not_found", error.message);
  }
  if (error instanceof ProviderError) {
    return failure(502, "provider_failure", error.message, { stage: error.stage });
  }

  const bodyParserFailure = toBodyParserFailure(error);
  if (bodyParserFailure !== null) {
    return bodyParserFailure;
  }

  return failure(500, "internal_error", "Internal server error");
}

/** Errors raised by express.json() before our code runs carry a `type` and an HTTP `status`. */
function toBodyParserFailure(error: unknown): HttpFailure | null {
  if (typeof error !== "object" || error === null) return null;
  const { type, status } = error as { type?: unknown; status?: unknown };

  if (type === "entity.parse.failed") {
    return failure(400, "invalid_json", "Request body is not valid JSON");
  }
  if (type === "entity.too.large") {
    return failure(413, "payload_too_large", "Request body is too large");
  }
  if (typeof status === "number" && status >= 400 && status < 500) {
    return failure(status, "bad_request", "The request could not be processed");
  }
  return null;
}

function failure(
  status: number,
  code: string,
  message: string,
  extra: { details?: FieldError[]; stage?: ScanStage } = {},
): HttpFailure {
  return { status, body: { error: { code, message, ...extra } } };
}

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  // Express only treats a function as an error handler if it declares 4 parameters.
  return (error, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const { status, body } = toHttpFailure(error);
    if (status >= 500) {
      logger.error(error);
    }
    res.status(status).json(body);
  };
}

/** Unknown routes also answer in JSON, like every other error. */
export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ErrorBody = {
    error: { code: "route_not_found", message: `Route ${req.method} ${req.path} does not exist` },
  };
  res.status(404).json(body);
};
