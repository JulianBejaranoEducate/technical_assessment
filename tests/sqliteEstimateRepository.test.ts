import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteEstimateRepository } from "../src/adapters/SqliteEstimateRepository.js";
import type { Estimate } from "../src/domain/types.js";

function makeEstimate(overrides: Partial<Estimate> = {}): Estimate {
  return {
    id: "est_demo",
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
    created_at: "2026-10-28T22:00:00.000Z",
    ...overrides,
  };
}

describe("SqliteEstimateRepository", () => {
  let dir: string;
  const opened: SqliteEstimateRepository[] = [];

  function open(filename: string): SqliteEstimateRepository {
    const repository = new SqliteEstimateRepository(filename);
    opened.push(repository);
    return repository;
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "estimates-test-"));
  });

  afterEach(() => {
    for (const repository of opened.splice(0)) {
      try {
        repository.close();
      } catch {
        // already closed by the test itself
      }
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it("saves an estimate and reads back exactly the same values", async () => {
    const repository = open(":memory:");
    const estimate = makeEstimate();

    await repository.save(estimate);

    expect(await repository.findById("est_demo")).toEqual(estimate);
  });

  it("keeps a null verification scan as null", async () => {
    const repository = open(":memory:");
    const estimate = makeEstimate({
      id: "est_failed_verification",
      status: "completed_with_warnings",
      stages: { initial: "completed", verification: "failed", consolidation: "completed" },
      scans: { initial: { antennas: 28, splitters: 6 }, verification: null },
      warnings: ["Verification scan failed"],
    });

    await repository.save(estimate);

    const saved = await repository.findById("est_failed_verification");
    expect(saved?.scans.verification).toBeNull();
    expect(saved).toEqual(estimate);
  });

  it("keeps an empty list of warnings", async () => {
    const repository = open(":memory:");
    await repository.save(makeEstimate({ status: "completed", warnings: [] }));

    expect((await repository.findById("est_demo"))?.warnings).toEqual([]);
  });

  it("returns null for an id that does not exist", async () => {
    const repository = open(":memory:");

    expect(await repository.findById("est_missing")).toBeNull();
  });

  it("keeps several estimates apart", async () => {
    const repository = open(":memory:");
    const first = makeEstimate({ id: "est_1", project: "Tower A" });
    const second = makeEstimate({ id: "est_2", project: "Tower B" });

    await repository.save(first);
    await repository.save(second);

    expect(await repository.findById("est_1")).toEqual(first);
    expect(await repository.findById("est_2")).toEqual(second);
  });

  it("refuses to overwrite an existing id", async () => {
    const repository = open(":memory:");
    await repository.save(makeEstimate());

    await expect(repository.save(makeEstimate({ project: "Other" }))).rejects.toThrow();
    expect((await repository.findById("est_demo"))?.project).toBe("Demo Building");
  });

  it("treats a hostile id as plain data (parameterized queries)", async () => {
    const repository = open(":memory:");
    await repository.save(makeEstimate());

    expect(await repository.findById("est_demo' OR '1'='1")).toBeNull();
    expect(await repository.findById("x'; DROP TABLE estimates; --")).toBeNull();
    expect(await repository.findById("est_demo")).not.toBeNull(); // table is intact
  });

  it("stores awkward text in the project name without breaking", async () => {
    const repository = open(":memory:");
    const estimate = makeEstimate({ project: `Torre "Ñandú" — O'Brien; DROP TABLE x; 日本` });

    await repository.save(estimate);

    expect((await repository.findById("est_demo"))?.project).toBe(estimate.project);
  });

  it("survives a restart: data written before closing is there when the file is reopened", async () => {
    // A nested path also proves the repository creates missing folders.
    const file = join(dir, "data", "estimates.db");
    const estimate = makeEstimate();

    const beforeRestart = open(file);
    await beforeRestart.save(estimate);
    beforeRestart.close();
    expect(existsSync(file)).toBe(true);

    const afterRestart = open(file);
    expect(await afterRestart.findById("est_demo")).toEqual(estimate);
  });

  it("can be reopened repeatedly without losing or duplicating data", async () => {
    const file = join(dir, "estimates.db");

    const first = open(file);
    await first.save(makeEstimate({ id: "est_1" }));
    first.close();

    const second = open(file); // opening again runs the schema setup a second time
    await second.save(makeEstimate({ id: "est_2" }));
    second.close();

    const third = open(file);
    expect(await third.findById("est_1")).not.toBeNull();
    expect(await third.findById("est_2")).not.toBeNull();
  });
});
