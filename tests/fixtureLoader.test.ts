import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadFixturesFromDirectory } from "../src/adapters/fixtureLoader.js";
import { MockScanProvider } from "../src/adapters/MockScanProvider.js";
import { ProviderError } from "../src/domain/errors.js";

const PROJECT_FIXTURES_DIR = fileURLToPath(new URL("../fixtures", import.meta.url));

describe("the fixtures shipped with the project", () => {
  const provider = new MockScanProvider(loadFixturesFromDirectory(PROJECT_FIXTURES_DIR));

  it("provides exactly demo, verification_failure and initial_failure", async () => {
    expect(await provider.listFixtures()).toEqual([
      "demo",
      "initial_failure",
      "verification_failure",
    ]);
  });

  it("demo: initial 28 antennas / 6 splitters, verification 26 / 6", async () => {
    expect(await provider.scan("demo", "initial")).toEqual({ antennas: 28, splitters: 6 });
    expect(await provider.scan("demo", "verification")).toEqual({ antennas: 26, splitters: 6 });
  });

  it("verification_failure: initial succeeds with the demo counts, verification fails", async () => {
    expect(await provider.scan("verification_failure", "initial")).toEqual({
      antennas: 28,
      splitters: 6,
    });
    await expect(provider.scan("verification_failure", "verification")).rejects.toBeInstanceOf(
      ProviderError,
    );
  });

  it("initial_failure: the initial scan fails", async () => {
    await expect(provider.scan("initial_failure", "initial")).rejects.toBeInstanceOf(ProviderError);
  });
});

describe("loadFixturesFromDirectory", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "fixtures-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const valid = {
    initial: { status: "completed", counts: { antennas: 1, splitters: 2 } },
    verification: { status: "completed", counts: { antennas: 1, splitters: 2 } },
  };

  it("uses the file name without extension as the fixture id", () => {
    writeFileSync(join(dir, "my_fixture.json"), JSON.stringify(valid));

    expect([...loadFixturesFromDirectory(dir).keys()]).toEqual(["my_fixture"]);
  });

  it("ignores files and folders that are not .json fixtures", () => {
    writeFileSync(join(dir, "README.md"), "not a fixture");
    writeFileSync(join(dir, "real.json"), JSON.stringify(valid));
    mkdirSync(join(dir, "subfolder"));

    expect([...loadFixturesFromDirectory(dir).keys()]).toEqual(["real"]);
  });

  it("throws when the directory does not exist", () => {
    expect(() => loadFixturesFromDirectory(join(dir, "nope"))).toThrow();
  });

  it("throws a clear error when a file is not valid JSON", () => {
    writeFileSync(join(dir, "broken.json"), "{ not json");

    expect(() => loadFixturesFromDirectory(dir)).toThrow(/Fixture "broken\.json" is not valid JSON/);
  });

  it.each([
    [
      "a negative count",
      { ...valid, initial: { status: "completed", counts: { antennas: -1, splitters: 2 } } },
      "initial.counts.antennas",
    ],
    [
      "a fractional count",
      { ...valid, initial: { status: "completed", counts: { antennas: 1.5, splitters: 2 } } },
      "initial.counts.antennas",
    ],
    [
      "a count that is a string",
      { ...valid, verification: { status: "completed", counts: { antennas: "3", splitters: 2 } } },
      "verification.counts.antennas",
    ],
    [
      "a missing equipment type",
      { ...valid, initial: { status: "completed", counts: { antennas: 1 } } },
      "initial.counts.splitters",
    ],
    [
      "an unknown equipment type",
      {
        ...valid,
        initial: { status: "completed", counts: { antennas: 1, splitters: 2, routers: 3 } },
      },
      "initial.counts",
    ],
    ["a missing stage", { initial: valid.initial }, "verification"],
    [
      "an unknown status",
      { ...valid, initial: { status: "pending" } },
      "initial.status",
    ],
    ["an unknown top-level key", { ...valid, extra: true }, "(root)"],
  ])("rejects a fixture with %s and names the offending field", (_label, content, where) => {
    writeFileSync(join(dir, "bad.json"), JSON.stringify(content));

    expect(() => loadFixturesFromDirectory(dir)).toThrow(
      new RegExp(`Fixture "bad\\.json" is invalid:.*${where.replace(/[().]/g, "\\$&")}`),
    );
  });
});
