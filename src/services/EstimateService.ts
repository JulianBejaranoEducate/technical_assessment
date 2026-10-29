import { randomUUID } from "node:crypto";
import { consolidate } from "../domain/consolidation.js";
import { EstimateNotFoundError, ProviderError, UnknownFixtureError } from "../domain/errors.js";
import { calculatePrice } from "../domain/pricing.js";
import type { EquipmentCounts, Estimate, StageStatuses } from "../domain/types.js";
import type { EstimateRepository } from "../ports/EstimateRepository.js";
import type { ScanProvider } from "../ports/ScanProvider.js";

/** Input that has already been validated at the API edge (see the HTTP layer). */
export interface CreateEstimateInput {
  project: string;
  floors: number;
  fixture: string;
}

export interface EstimateServiceDependencies {
  provider: ScanProvider;
  repository: EstimateRepository;
  /** Override in tests to get predictable ids. */
  generateId?: () => string;
  /** Override in tests to get a predictable timestamp. */
  now?: () => Date;
}

/**
 * Orchestrates the three stages. It only knows the two ports (ScanProvider and
 * EstimateRepository), never files, SQL or HTTP.
 */
export class EstimateService {
  private readonly provider: ScanProvider;
  private readonly repository: EstimateRepository;
  private readonly generateId: () => string;
  private readonly now: () => Date;

  constructor(dependencies: EstimateServiceDependencies) {
    this.provider = dependencies.provider;
    this.repository = dependencies.repository;
    this.generateId = dependencies.generateId ?? (() => `est_${randomUUID()}`);
    this.now = dependencies.now ?? (() => new Date());
  }

  async create(input: CreateEstimateInput): Promise<Estimate> {
    await this.assertFixtureExists(input.fixture);

    // Stage 1: initial scan. It is authoritative, so if it fails there is nothing to
    // estimate: the ProviderError propagates and nothing is saved.
    const initial = await this.provider.scan(input.fixture, "initial");

    // Stage 2: verification scan. If it fails we still have the initial counts, so the
    // estimate is created and the failure is recorded as a warning.
    const verification = await this.tryVerificationScan(input.fixture);

    // Stage 3: deterministic consolidation and pricing (plain application logic).
    const { selected, warnings } = consolidate(initial, verification);
    const { line_items, total } = calculatePrice(input.floors, selected);

    const stages: StageStatuses = {
      initial: "completed",
      verification: verification === null ? "failed" : "completed",
      consolidation: "completed",
    };

    const estimate: Estimate = {
      id: this.generateId(),
      project: input.project,
      floors: input.floors,
      fixture: input.fixture,
      status: warnings.length > 0 ? "completed_with_warnings" : "completed",
      stages,
      scans: { initial, verification },
      selected,
      line_items,
      total,
      warnings,
      created_at: this.now().toISOString(),
    };

    await this.repository.save(estimate);
    return estimate;
  }

  async get(id: string): Promise<Estimate> {
    const estimate = await this.repository.findById(id);
    if (estimate === null) {
      throw new EstimateNotFoundError(id);
    }
    return estimate;
  }

  private async assertFixtureExists(fixture: string): Promise<void> {
    const available = await this.provider.listFixtures();
    if (!available.includes(fixture)) {
      throw new UnknownFixtureError(fixture, available);
    }
  }

  /**
   * Returns the verification counts, or null if the provider reported a failure.
   * Only ProviderError is absorbed: any other error is a bug in our own code and
   * must not be disguised as "the verification scan failed".
   */
  private async tryVerificationScan(fixture: string): Promise<EquipmentCounts | null> {
    try {
      return await this.provider.scan(fixture, "verification");
    } catch (error) {
      if (error instanceof ProviderError) {
        return null;
      }
      throw error;
    }
  }
}
