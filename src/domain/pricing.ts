import type { EquipmentCounts, LineItems } from "./types.js";

/** Fictional price list, in whole USD. This is the only place where prices live. */
export const PRICES = {
  floor: 100,
  antenna: 250,
  splitter: 80,
} as const;

export interface PriceResult {
  line_items: LineItems;
  total: number;
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    // Input is validated at the API edge, so reaching this means a bug, not a client mistake.
    throw new RangeError(`${name} must be a nonnegative integer, received ${value}`);
  }
}

/**
 * Pure and deterministic: the same inputs always produce the same price.
 * No taxes, discounts or other charges; every amount is an integer.
 */
export function calculatePrice(floors: number, selected: EquipmentCounts): PriceResult {
  assertNonNegativeInteger(floors, "floors");
  assertNonNegativeInteger(selected.antennas, "antennas");
  assertNonNegativeInteger(selected.splitters, "splitters");

  const line_items: LineItems = {
    floors: PRICES.floor * floors,
    antennas: PRICES.antenna * selected.antennas,
    splitters: PRICES.splitter * selected.splitters,
  };

  return {
    line_items,
    total: line_items.floors + line_items.antennas + line_items.splitters,
  };
}
