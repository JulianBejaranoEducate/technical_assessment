import { ProviderError, UnknownFixtureError } from "../domain/errors.js";
import type { EquipmentCounts, ScanStage } from "../domain/types.js";
import type { ScanProvider } from "../ports/ScanProvider.js";
import type { Fixture } from "./fixtureSchema.js";

const STAGE_LABEL: Record<ScanStage, string> = {
  initial: "Initial",
  verification: "Verification",
};

/**
 * Local stand-in for the automated analysis system. It replays pre-recorded
 * results from fixtures and never touches the network, files or credentials.
 *
 * It receives already-loaded fixtures (see loadFixturesFromDirectory), so it knows
 * nothing about paths either.
 */
export class MockScanProvider implements ScanProvider {
  private readonly fixtures: ReadonlyMap<string, Fixture>;

  constructor(fixtures: ReadonlyMap<string, Fixture>) {
    this.fixtures = fixtures;
  }

  async listFixtures(): Promise<string[]> {
    return [...this.fixtures.keys()].sort();
  }

  async scan(fixtureId: string, stage: ScanStage): Promise<EquipmentCounts> {
    const fixture = this.fixtures.get(fixtureId);
    if (fixture === undefined) {
      throw new UnknownFixtureError(fixtureId, await this.listFixtures());
    }

    const result = fixture[stage];
    if (result.status === "failed") {
      const detail = result.error === undefined ? "" : `: ${result.error}`;
      throw new ProviderError(stage, `${STAGE_LABEL[stage]} scan failed${detail}`);
    }

    // Hand out a copy so callers can never modify the stored fixture.
    return { ...result.counts };
  }
}
