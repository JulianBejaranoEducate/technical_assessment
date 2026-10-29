import { describe, expect, it } from "vitest";
import type { Fixture } from "../src/adapters/fixtureSchema.js";
import { MockScanProvider } from "../src/adapters/MockScanProvider.js";
import { ProviderError, UnknownFixtureError } from "../src/domain/errors.js";

const fixtures = new Map<string, Fixture>([
  [
    "ok",
    {
      initial: { status: "completed", counts: { antennas: 10, splitters: 2 } },
      verification: { status: "completed", counts: { antennas: 9, splitters: 2 } },
    },
  ],
  [
    "flaky",
    {
      initial: { status: "completed", counts: { antennas: 10, splitters: 2 } },
      verification: { status: "failed", error: "timeout" },
    },
  ],
  [
    "down",
    {
      initial: { status: "failed" },
      verification: { status: "completed", counts: { antennas: 1, splitters: 1 } },
    },
  ],
]);

describe("MockScanProvider", () => {
  const provider = new MockScanProvider(fixtures);

  it("lists its fixtures in alphabetical order", async () => {
    expect(await provider.listFixtures()).toEqual(["down", "flaky", "ok"]);
  });

  it("returns the recorded counts for each stage", async () => {
    expect(await provider.scan("ok", "initial")).toEqual({ antennas: 10, splitters: 2 });
    expect(await provider.scan("ok", "verification")).toEqual({ antennas: 9, splitters: 2 });
  });

  it("rejects with a ProviderError that names the stage when a scan fails", async () => {
    const failure = provider.scan("flaky", "verification");

    await expect(failure).rejects.toBeInstanceOf(ProviderError);
    await expect(failure).rejects.toMatchObject({
      stage: "verification",
      message: "Verification scan failed: timeout",
    });
  });

  it("uses a default message when the failed stage has no error text", async () => {
    await expect(provider.scan("down", "initial")).rejects.toMatchObject({
      stage: "initial",
      message: "Initial scan failed",
    });
  });

  it("still succeeds for the stage that did not fail", async () => {
    expect(await provider.scan("flaky", "initial")).toEqual({ antennas: 10, splitters: 2 });
  });

  it("rejects an unknown fixture with an error that lists the available ones", async () => {
    const failure = provider.scan("missing", "initial");

    await expect(failure).rejects.toBeInstanceOf(UnknownFixtureError);
    await expect(failure).rejects.toThrow(/Unknown fixture "missing".*down, flaky, ok/);
  });

  it.each(["constructor", "__proto__", "toString", "hasOwnProperty"])(
    "does not treat the inherited property name %s as a fixture",
    async (name) => {
      expect(await provider.listFixtures()).not.toContain(name);
      await expect(provider.scan(name, "initial")).rejects.toBeInstanceOf(UnknownFixtureError);
    },
  );

  it("hands out copies, so callers cannot modify the stored fixture", async () => {
    const first = await provider.scan("ok", "initial");
    first.antennas = 999;

    expect(await provider.scan("ok", "initial")).toEqual({ antennas: 10, splitters: 2 });
  });
});
