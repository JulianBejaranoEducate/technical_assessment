import { EQUIPMENT_TYPES, type EquipmentCounts, type EquipmentType } from "./types.js";

export interface ConsolidationResult {
  selected: EquipmentCounts;
  warnings: string[];
}

/** Singular, human-readable label used in warning messages ("Antenna count mismatch: 28 vs 26"). */
const LABELS: Record<EquipmentType, string> = {
  antennas: "Antenna",
  splitters: "Splitter",
};

export const VERIFICATION_FAILED_WARNING = "Verification scan failed";

/**
 * Stage 3: deterministic consolidation. This is plain application logic, not an AI call.
 *
 * Selection rule:
 *  - The initial scan is authoritative: its counts are always the selected ones.
 *  - If the verification scan disagrees, keep the initial counts and add one warning
 *    per differing equipment type.
 *  - If the verification scan failed (`verification === null`), keep the initial
 *    counts and add a failure warning.
 *
 * Warnings follow the order of EQUIPMENT_TYPES, so the output is always repeatable.
 */
export function consolidate(
  initial: EquipmentCounts,
  verification: EquipmentCounts | null,
): ConsolidationResult {
  const selected: EquipmentCounts = { ...initial };

  if (verification === null) {
    return { selected, warnings: [VERIFICATION_FAILED_WARNING] };
  }

  const warnings: string[] = [];
  for (const type of EQUIPMENT_TYPES) {
    if (initial[type] !== verification[type]) {
      warnings.push(`${LABELS[type]} count mismatch: ${initial[type]} vs ${verification[type]}`);
    }
  }

  return { selected, warnings };
}
