import { describe, expect, it } from "vitest";
import { calculatePrice, PRICES } from "../src/domain/pricing.js";

describe("calculatePrice", () => {
  it("prices the demo estimate: 12 floors, 28 antennas, 6 splitters = $8,680", () => {
    const result = calculatePrice(12, { antennas: 28, splitters: 6 });

    expect(result.line_items).toEqual({ floors: 1200, antennas: 7000, splitters: 480 });
    expect(result.total).toBe(8680);
  });

  it("uses the documented price list", () => {
    expect(PRICES).toEqual({ floor: 100, antenna: 250, splitter: 80 });
  });

  it("charges only for floors when there is no equipment", () => {
    const result = calculatePrice(1, { antennas: 0, splitters: 0 });

    expect(result.line_items).toEqual({ floors: 100, antennas: 0, splitters: 0 });
    expect(result.total).toBe(100);
  });

  it("prices each item independently", () => {
    const result = calculatePrice(3, { antennas: 1, splitters: 2 });

    expect(result.line_items).toEqual({ floors: 300, antennas: 250, splitters: 160 });
    expect(result.total).toBe(710);
  });

  it("makes the total equal to the sum of the line items", () => {
    const { line_items, total } = calculatePrice(7, { antennas: 13, splitters: 9 });

    expect(total).toBe(line_items.floors + line_items.antennas + line_items.splitters);
  });

  it("is deterministic: the same input always gives the same price", () => {
    const counts = { antennas: 28, splitters: 6 };

    expect(calculatePrice(12, counts)).toEqual(calculatePrice(12, counts));
  });

  it("returns integer amounts only", () => {
    const { line_items, total } = calculatePrice(12, { antennas: 28, splitters: 6 });

    for (const amount of [...Object.values(line_items), total]) {
      expect(Number.isInteger(amount)).toBe(true);
    }
  });

  describe("invariant guards (bugs, not client errors: input is validated at the API edge)", () => {
    it.each([
      ["negative floors", -1, { antennas: 1, splitters: 1 }],
      ["fractional floors", 1.5, { antennas: 1, splitters: 1 }],
      ["NaN floors", Number.NaN, { antennas: 1, splitters: 1 }],
      ["negative antennas", 1, { antennas: -1, splitters: 1 }],
      ["fractional splitters", 1, { antennas: 1, splitters: 0.5 }],
    ])("throws a RangeError for %s", (_label, floors, counts) => {
      expect(() => calculatePrice(floors, counts)).toThrow(RangeError);
    });
  });
});
