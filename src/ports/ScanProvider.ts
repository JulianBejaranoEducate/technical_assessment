import type { EquipmentCounts, ScanStage } from "../domain/types.js";

/**
 * Port: what the estimate service needs from whatever produces the scans.
 *
 * The service depends on this interface only. It never sees fixture files, paths
 * or JSON. A real implementation (an AI document-analysis API) could replace the
 * mock without touching the service.
 */
export interface ScanProvider {
  /** Identifiers of the fixtures this provider can scan. */
  listFixtures(): Promise<string[]>;

  /**
   * Run one scan stage and return the equipment counts it reported.
   * Rejects with ProviderError when the scan fails.
   */
  scan(fixture: string, stage: ScanStage): Promise<EquipmentCounts>;
}
