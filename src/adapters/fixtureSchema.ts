import { z } from "zod";
import type { EquipmentCounts } from "../domain/types.js";

/**
 * Fixture file format (one JSON file per fixture; the file name is the fixture id):
 *
 *   {
 *     "description": "optional free text",
 *     "initial":      { "status": "completed", "counts": { "antennas": 28, "splitters": 6 } },
 *     "verification": { "status": "failed",    "error": "optional message" }
 *   }
 *
 * Each stage ("initial", "verification") is either:
 *   - completed: with `counts`, nonnegative integers for every equipment type, or
 *   - failed:    with an optional `error` message. The mock provider raises a ProviderError.
 *
 * Unknown keys are rejected so typos in a fixture fail loudly when it is loaded.
 */

const countSchema = z.number().int().min(0);

const countsSchema = z.strictObject({
  antennas: countSchema,
  splitters: countSchema,
}) satisfies z.ZodType<EquipmentCounts>; // compile-time check: schema and EquipmentCounts stay in sync

const completedScanSchema = z.strictObject({
  status: z.literal("completed"),
  counts: countsSchema,
});

const failedScanSchema = z.strictObject({
  status: z.literal("failed"),
  error: z.string().min(1).optional(),
});

const scanResultSchema = z.discriminatedUnion("status", [completedScanSchema, failedScanSchema]);

export const fixtureSchema = z.strictObject({
  description: z.string().optional(),
  initial: scanResultSchema,
  verification: scanResultSchema,
});

export type Fixture = z.infer<typeof fixtureSchema>;
