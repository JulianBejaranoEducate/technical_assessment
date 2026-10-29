import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { loadFixturesFromDirectory } from "../src/adapters/fixtureLoader.js";
import { MockScanProvider } from "../src/adapters/MockScanProvider.js";
import {
  EstimateNotFoundError,
  ProviderError,
  UnknownFixtureError,
} from "../src/domain/errors.js";
import type { EquipmentCounts, ScanStage } from "../src/domain/types.js";
import type { ScanProvider } from "../src/ports/ScanProvider.js";
import { EstimateService } from "../src/services/EstimateService.js";
import { InMemoryEstimateRepository, RecordingProvider } from "./helpers/fakes.js";

const PROJECT_FIXTURES_DIR = fileURLToPath(new URL("../fixtures", import.meta.url));

// The three fixtures shipped with the project, plus one extra where both scans agree.
const fixtures = loadFixturesFromDirectory(PROJECT_FIXTURES_DIR);
fixtures.set("consistent", {
  initial: { status: "completed", counts: { antennas: 20, splitters: 4 } },
  verification: { status: "completed", counts: { antennas: 20, splitters: 4 } },
});

describe("EstimateService", () => {
  let provider: RecordingProvider;
  let repository: InMemoryEstimateRepository;
  let service: EstimateService;

  beforeEach(() => {
    provider = new RecordingProvider(new MockScanProvider(fixtures));
    repository = new InMemoryEstimateRepository();
    service = new EstimateService({ provider, repository });
  });

  describe("create: demo fixture (verification disagrees)", () => {
    it("keeps the initial counts, warns about the discrepancy and totals $8,680", async () => {
      const estimate = await service.create({ project: "Demo Building", floors: 12, fixture: "demo" });

      expect(estimate).toMatchObject({
        project: "Demo Building",
        floors: 12,
        fixture: "demo",
        status: "completed_with_warnings",
        stages: { initial: "completed", verification: "completed", consolidation: "completed" },
        scans: {
          initial: { antennas: 28, splitters: 6 },
          verification: { antennas: 26, splitters: 6 },
        },
        selected: { antennas: 28, splitters: 6 },
        line_items: { floors: 1200, antennas: 7000, splitters: 480 },
        total: 8680,
        warnings: ["Antenna count mismatch: 28 vs 26"],
      });
    });

    it("generates an id and a timestamp, and saves exactly what it returns", async () => {
      const estimate = await service.create({ project: "Demo Building", floors: 12, fixture: "demo" });

      expect(estimate.id).toMatch(/^est_[0-9a-f-]{36}$/);
      expect(new Date(estimate.created_at).toISOString()).toBe(estimate.created_at);
      expect(repository.saved).toEqual([estimate]);
    });

    it("runs the initial scan first and the verification scan second", async () => {
      await service.create({ project: "Demo Building", floors: 12, fixture: "demo" });

      expect(provider.scans).toEqual([
        { fixture: "demo", stage: "initial" },
        { fixture: "demo", stage: "verification" },
      ]);
    });

    it("prices with the floors it was given", async () => {
      const estimate = await service.create({ project: "Small", floors: 3, fixture: "demo" });

      expect(estimate.line_items).toEqual({ floors: 300, antennas: 7000, splitters: 480 });
      expect(estimate.total).toBe(7780);
    });
  });

  describe("create: scans agree", () => {
    it("completes without warnings", async () => {
      const estimate = await service.create({ project: "Calm", floors: 2, fixture: "consistent" });

      expect(estimate.status).toBe("completed");
      expect(estimate.warnings).toEqual([]);
      expect(estimate.selected).toEqual({ antennas: 20, splitters: 4 });
      expect(estimate.total).toBe(2 * 100 + 20 * 250 + 4 * 80);
    });
  });

  describe("create: verification failure", () => {
    it("still saves an estimate from the initial counts, with a failure warning", async () => {
      const estimate = await service.create({
        project: "Demo Building",
        floors: 12,
        fixture: "verification_failure",
      });

      expect(estimate).toMatchObject({
        status: "completed_with_warnings",
        stages: { initial: "completed", verification: "failed", consolidation: "completed" },
        scans: { initial: { antennas: 28, splitters: 6 }, verification: null },
        selected: { antennas: 28, splitters: 6 },
        total: 8680,
        warnings: ["Verification scan failed"],
      });
      expect(repository.saved).toEqual([estimate]);
    });
  });

  describe("create: initial failure", () => {
    it("rejects with a ProviderError and saves nothing", async () => {
      const attempt = service.create({ project: "Demo Building", floors: 12, fixture: "initial_failure" });

      await expect(attempt).rejects.toBeInstanceOf(ProviderError);
      await expect(attempt).rejects.toMatchObject({ stage: "initial" });
      expect(repository.saved).toEqual([]);
    });

    it("does not even try the verification scan", async () => {
      await service
        .create({ project: "Demo Building", floors: 12, fixture: "initial_failure" })
        .catch(() => undefined);

      expect(provider.scans).toEqual([{ fixture: "initial_failure", stage: "initial" }]);
    });
  });

  describe("create: unknown fixture", () => {
    it("rejects with an UnknownFixtureError, never calls the provider and saves nothing", async () => {
      const attempt = service.create({ project: "Demo Building", floors: 12, fixture: "nope" });

      await expect(attempt).rejects.toBeInstanceOf(UnknownFixtureError);
      expect(provider.scans).toEqual([]);
      expect(repository.saved).toEqual([]);
    });
  });

  describe("create: failures that are not provider failures", () => {
    function providerThatBreaksOn(stage: ScanStage, error: Error): ScanProvider {
      const counts: EquipmentCounts = { antennas: 1, splitters: 1 };
      return {
        listFixtures: async () => ["demo"],
        scan: async (_fixture, requested) => {
          if (requested === stage) throw error;
          return counts;
        },
      };
    }

    it("does not disguise a bug during verification as a failed verification scan", async () => {
      service = new EstimateService({
        provider: providerThatBreaksOn("verification", new TypeError("bug in our code")),
        repository,
      });

      await expect(
        service.create({ project: "Demo Building", floors: 12, fixture: "demo" }),
      ).rejects.toThrow(TypeError);
      expect(repository.saved).toEqual([]);
    });

    it("lets a storage failure surface instead of swallowing it", async () => {
      repository.save = async () => {
        throw new Error("disk full");
      };

      await expect(
        service.create({ project: "Demo Building", floors: 12, fixture: "demo" }),
      ).rejects.toThrow("disk full");
    });
  });

  describe("create: injected id and clock", () => {
    it("uses them when provided", async () => {
      service = new EstimateService({
        provider,
        repository,
        generateId: () => "est_fixed",
        now: () => new Date("2026-01-01T00:00:00.000Z"),
      });

      const estimate = await service.create({ project: "Demo Building", floors: 12, fixture: "demo" });

      expect(estimate.id).toBe("est_fixed");
      expect(estimate.created_at).toBe("2026-01-01T00:00:00.000Z");
    });

    it("generates a different id for every estimate by default", async () => {
      const first = await service.create({ project: "A", floors: 1, fixture: "demo" });
      const second = await service.create({ project: "B", floors: 1, fixture: "demo" });

      expect(first.id).not.toBe(second.id);
    });
  });

  describe("get", () => {
    it("returns a saved estimate", async () => {
      const created = await service.create({ project: "Demo Building", floors: 12, fixture: "demo" });

      expect(await service.get(created.id)).toEqual(created);
    });

    it("rejects with an EstimateNotFoundError for an unknown id", async () => {
      await expect(service.get("est_missing")).rejects.toBeInstanceOf(EstimateNotFoundError);
    });
  });
});
