import { describe, expect, it } from "vitest";
import { actualBillableMinutes, companionServiceTotal, extendCompanionDuration, MAX_COMPANION_SERVICE_MINUTES, normalizeCompanionDuration } from "./companionBilling";

describe("companion service duration and billing", () => {
  it("enforces one hour minimum and 30-minute booking increments", () => {
    expect(normalizeCompanionDuration(20)).toBe(60);
    expect(normalizeCompanionDuration(89)).toBe(90);
    expect(normalizeCompanionDuration(121)).toBe(120);
  });

  it("prices a 1.5-hour booking and a 30-minute extension exactly", () => {
    expect(companionServiceTotal(18_000, 90)).toBe(27_000);
    expect(companionServiceTotal(18_000, 120)).toBe(36_000);
  });

  it("bills final actual time by the minute with a one-hour minimum", () => {
    expect(actualBillableMinutes(8 * 60)).toBe(60);
    expect(actualBillableMinutes(90 * 60 + 1)).toBe(91);
  });

  it("hard-caps booking, extensions, actual time, and billing at twelve hours", () => {
    expect(normalizeCompanionDuration(24 * 60)).toBe(MAX_COMPANION_SERVICE_MINUTES);
    expect(extendCompanionDuration(11.5 * 60)).toBe(MAX_COMPANION_SERVICE_MINUTES);
    expect(extendCompanionDuration(MAX_COMPANION_SERVICE_MINUTES)).toBe(MAX_COMPANION_SERVICE_MINUTES);
    expect(actualBillableMinutes(25 * 60 * 60)).toBe(MAX_COMPANION_SERVICE_MINUTES);
    expect(companionServiceTotal(18_000, 25 * 60)).toBe(18_000 * 12);
  });
});
