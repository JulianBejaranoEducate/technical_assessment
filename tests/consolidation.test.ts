import { describe, expect, it } from "vitest";
import { consolidate, VERIFICATION_FAILED_WARNING } from "../src/domain/consolidation.js";

describe("consolidate", () => {
  it("selects the initial counts and records no warnings when both scans agree", () => {
    const result = consolidate({ antennas: 28, splitters: 6 }, { antennas: 28, splitters: 6 });

    expect(result.selected).toEqual({ antennas: 28, splitters: 6 });
    expect(result.warnings).toEqual([]);
  });

  it("keeps the initial counts and warns when verification disagrees (demo fixture)", () => {
    const result = consolidate({ antennas: 28, splitters: 6 }, { antennas: 26, splitters: 6 });

    expect(result.selected).toEqual({ antennas: 28, splitters: 6 });
    expect(result.warnings).toEqual(["Antenna count mismatch: 28 vs 26"]);
  });

  it("warns about splitters only when only splitters differ", () => {
    const result = consolidate({ antennas: 28, splitters: 6 }, { antennas: 28, splitters: 9 });

    expect(result.selected).toEqual({ antennas: 28, splitters: 6 });
    expect(result.warnings).toEqual(["Splitter count mismatch: 6 vs 9"]);
  });

  it("records one warning per differing equipment type, in a stable order", () => {
    const result = consolidate({ antennas: 28, splitters: 6 }, { antennas: 30, splitters: 5 });

    expect(result.selected).toEqual({ antennas: 28, splitters: 6 });
    expect(result.warnings).toEqual([
      "Antenna count mismatch: 28 vs 30",
      "Splitter count mismatch: 6 vs 5",
    ]);
  });

  it("never prefers verification, even when it reports more equipment", () => {
    const result = consolidate({ antennas: 10, splitters: 2 }, { antennas: 50, splitters: 20 });

    expect(result.selected).toEqual({ antennas: 10, splitters: 2 });
  });

  it("keeps the initial counts and records a failure warning when verification failed", () => {
    const result = consolidate({ antennas: 28, splitters: 6 }, null);

    expect(result.selected).toEqual({ antennas: 28, splitters: 6 });
    expect(result.warnings).toEqual([VERIFICATION_FAILED_WARNING]);
    expect(result.warnings[0]).toContain("Verification scan failed");
  });

  it("returns a copy of the initial counts and does not mutate its inputs", () => {
    const initial = { antennas: 28, splitters: 6 };
    const verification = { antennas: 26, splitters: 6 };

    const result = consolidate(initial, verification);

    expect(result.selected).not.toBe(initial);
    expect(initial).toEqual({ antennas: 28, splitters: 6 });
    expect(verification).toEqual({ antennas: 26, splitters: 6 });
  });
});
