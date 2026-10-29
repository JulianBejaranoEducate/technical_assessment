import { describe, expect, it } from "vitest";
import { ValidationError, type FieldError } from "../src/domain/errors.js";
import {
  MAX_FIXTURE_LENGTH,
  MAX_FLOORS,
  MAX_PROJECT_LENGTH,
  parseCreateEstimateRequest,
} from "../src/http/validation.js";

function detailsOf(body: unknown): FieldError[] {
  try {
    parseCreateEstimateRequest(body);
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    return (error as ValidationError).details;
  }
  throw new Error("expected the request to be rejected, but it was accepted");
}

describe("parseCreateEstimateRequest: valid input", () => {
  it("returns the typed input", () => {
    expect(parseCreateEstimateRequest({ project: "Demo Building", floors: 12, fixture: "demo" })).toEqual({
      project: "Demo Building",
      floors: 12,
      fixture: "demo",
    });
  });

  it("trims surrounding spaces from project and fixture", () => {
    expect(parseCreateEstimateRequest({ project: "  Tower A  ", floors: 3, fixture: " demo " })).toEqual({
      project: "Tower A",
      floors: 3,
      fixture: "demo",
    });
  });

  it("ignores unknown extra fields", () => {
    const input = parseCreateEstimateRequest({ project: "A", floors: 1, fixture: "demo", extra: true });

    expect(input).toEqual({ project: "A", floors: 1, fixture: "demo" });
  });

  it("accepts the boundary values", () => {
    expect(() =>
      parseCreateEstimateRequest({
        project: "p".repeat(MAX_PROJECT_LENGTH),
        floors: 1,
        fixture: "f".repeat(MAX_FIXTURE_LENGTH),
      }),
    ).not.toThrow();
    expect(() => parseCreateEstimateRequest({ project: "A", floors: MAX_FLOORS, fixture: "demo" })).not.toThrow();
  });
});

describe("parseCreateEstimateRequest: invalid input", () => {
  it("reports every problem at once (the exercise example: empty project and 0 floors)", () => {
    expect(detailsOf({ project: "", floors: 0, fixture: "demo" })).toEqual([
      { field: "project", message: "must not be empty" },
      { field: "floors", message: "must be a positive integer" },
    ]);
  });

  it("reports all three fields when the body is an empty object", () => {
    expect(detailsOf({})).toEqual([
      { field: "project", message: "is required" },
      { field: "floors", message: "is required" },
      { field: "fixture", message: "is required" },
    ]);
  });

  it.each<[string, unknown, FieldError]>([
    ["a project made only of spaces", { project: "   ", floors: 1, fixture: "demo" }, { field: "project", message: "must not be empty" }],
    ["a numeric project", { project: 5, floors: 1, fixture: "demo" }, { field: "project", message: "must be a string (received number)" }],
    ["a null project", { project: null, floors: 1, fixture: "demo" }, { field: "project", message: "must be a string (received null)" }],
    [
      "a project that is too long",
      { project: "x".repeat(MAX_PROJECT_LENGTH + 1), floors: 1, fixture: "demo" },
      { field: "project", message: `must be at most ${MAX_PROJECT_LENGTH} characters` },
    ],
    ["floors = 0", { project: "A", floors: 0, fixture: "demo" }, { field: "floors", message: "must be a positive integer" }],
    ["negative floors", { project: "A", floors: -3, fixture: "demo" }, { field: "floors", message: "must be a positive integer" }],
    ["fractional floors", { project: "A", floors: 1.5, fixture: "demo" }, { field: "floors", message: "must be a positive integer" }],
    ["floors given as a string", { project: "A", floors: "12", fixture: "demo" }, { field: "floors", message: "must be a positive integer (received string)" }],
    ["null floors", { project: "A", floors: null, fixture: "demo" }, { field: "floors", message: "must be a positive integer (received null)" }],
    ["boolean floors", { project: "A", floors: true, fixture: "demo" }, { field: "floors", message: "must be a positive integer (received boolean)" }],
    ["floors above the maximum", { project: "A", floors: MAX_FLOORS + 1, fixture: "demo" }, { field: "floors", message: `must be at most ${MAX_FLOORS}` }],
    ["an empty fixture", { project: "A", floors: 1, fixture: "" }, { field: "fixture", message: "must not be empty" }],
    ["a numeric fixture", { project: "A", floors: 1, fixture: 7 }, { field: "fixture", message: "must be a string (received number)" }],
  ])("rejects %s with one clear message", (_label, body, expected) => {
    expect(detailsOf(body)).toEqual([expected]);
  });

  it("does not repeat a message when two checks fail the same way (-1.5)", () => {
    expect(detailsOf({ project: "A", floors: -1.5, fixture: "demo" })).toEqual([
      { field: "floors", message: "must be a positive integer" },
    ]);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["an array", []],
    ["a string", "text"],
    ["a number", 42],
  ])("rejects a body that is %s, naming the field 'body'", (_label, body) => {
    expect(detailsOf(body)).toEqual([
      { field: "body", message: "must be a JSON object (send it with Content-Type: application/json)" },
    ]);
  });
});
