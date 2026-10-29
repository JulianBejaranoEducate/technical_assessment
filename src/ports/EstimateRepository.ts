import type { Estimate } from "../domain/types.js";

/**
 * Port: where finished estimates are stored.
 * The interface is async even though SQLite is synchronous, so swapping in a
 * networked database later (for example PostgreSQL) would not change the service.
 */
export interface EstimateRepository {
  save(estimate: Estimate): Promise<void>;
  findById(id: string): Promise<Estimate | null>;
}
