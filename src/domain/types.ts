/**
 * Core domain types. Nothing in this folder knows about HTTP, SQLite or files.
 * That keeps the business rules (pricing, consolidation) easy to test and change.
 */

/** Equipment types the scan system can report. Add a new type here (and in PRICES) to extend the model. */
export const EQUIPMENT_TYPES = ["antennas", "splitters"] as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

/** What one scan reports: a nonnegative integer count per equipment type. */
export type EquipmentCounts = Record<EquipmentType, number>;

/** The two scan stages. Stage 3 (consolidation) is application logic, not a scan. */
export type ScanStage = "initial" | "verification";

export type ScanStageStatus = "completed" | "failed";

export interface StageStatuses {
  initial: ScanStageStatus;
  verification: ScanStageStatus;
  consolidation: "completed";
}

/** `completed_with_warnings` is used whenever at least one warning was recorded. */
export type EstimateStatus = "completed" | "completed_with_warnings";

export interface LineItems {
  floors: number;
  antennas: number;
  splitters: number;
}

/**
 * A saved estimate. Field names match the JSON contract of the API
 * (hence `line_items` in snake_case), so the HTTP layer can return it as is.
 */
export interface Estimate {
  id: string;
  project: string;
  floors: number;
  fixture: string;
  status: EstimateStatus;
  stages: StageStatuses;
  scans: {
    initial: EquipmentCounts;
    /** null when the verification scan failed: there is no raw result to keep. */
    verification: EquipmentCounts | null;
  };
  selected: EquipmentCounts;
  line_items: LineItems;
  total: number;
  warnings: string[];
  created_at: string;
}
