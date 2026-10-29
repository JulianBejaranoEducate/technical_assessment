import type { Estimate, ScanStage, EquipmentCounts } from "../../src/domain/types.js";
import type { EstimateRepository } from "../../src/ports/EstimateRepository.js";
import type { ScanProvider } from "../../src/ports/ScanProvider.js";

/** Keeps estimates in memory and records every save, so tests can assert "nothing was saved". */
export class InMemoryEstimateRepository implements EstimateRepository {
  readonly saved: Estimate[] = [];

  async save(estimate: Estimate): Promise<void> {
    this.saved.push(structuredClone(estimate));
  }

  async findById(id: string): Promise<Estimate | null> {
    return structuredClone(this.saved.find((estimate) => estimate.id === id) ?? null);
  }
}

/** Wraps a real provider and records every scan request, so tests can assert "the provider was not called". */
export class RecordingProvider implements ScanProvider {
  readonly scans: Array<{ fixture: string; stage: ScanStage }> = [];
  private readonly inner: ScanProvider;

  constructor(inner: ScanProvider) {
    this.inner = inner;
  }

  listFixtures(): Promise<string[]> {
    return this.inner.listFixtures();
  }

  scan(fixture: string, stage: ScanStage): Promise<EquipmentCounts> {
    this.scans.push({ fixture, stage });
    return this.inner.scan(fixture, stage);
  }
}
