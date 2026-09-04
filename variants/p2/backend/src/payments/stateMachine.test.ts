import { describe, it, expect } from "vitest";
import { canTransition, assertTransition, InvalidTransitionError } from "./stateMachine.js";

describe("payment state machine", () => {
  it("allows the happy path", () => {
    expect(canTransition("DRAFT", "COMPLIANCE_CHECK")).toBe(true);
    expect(canTransition("COMPLIANCE_CHECK", "RATE_LOCKED")).toBe(true);
    expect(canTransition("RATE_LOCKED", "FUNDED")).toBe(true);
    expect(canTransition("FUNDED", "SETTLING")).toBe(true);
    expect(canTransition("SETTLING", "COMPLETED")).toBe(true);
  });

  it("allows compliance branches", () => {
    expect(canTransition("COMPLIANCE_CHECK", "REJECTED")).toBe(true);
    expect(canTransition("COMPLIANCE_CHECK", "FLAGGED")).toBe(true);
    expect(canTransition("FLAGGED", "RATE_LOCKED")).toBe(true);
    expect(canTransition("FLAGGED", "REJECTED")).toBe(true);
  });

  it("allows side paths", () => {
    expect(canTransition("FUNDED", "REFUNDED")).toBe(true);
    expect(canTransition("SETTLING", "REFUNDED")).toBe(true);
    expect(canTransition("RATE_LOCKED", "EXPIRED")).toBe(true);
  });

  it("rejects illegal jumps", () => {
    expect(canTransition("DRAFT", "COMPLETED")).toBe(false);
    expect(canTransition("COMPLETED", "REFUNDED")).toBe(false);
    expect(canTransition("REJECTED", "RATE_LOCKED")).toBe(false);
    expect(canTransition("COMPLIANCE_CHECK", "FUNDED")).toBe(false);
  });

  it("assertTransition throws on illegal transitions", () => {
    expect(() => assertTransition("DRAFT", "COMPLETED")).toThrow(InvalidTransitionError);
    expect(() => assertTransition("DRAFT", "COMPLIANCE_CHECK")).not.toThrow();
  });

  it("terminal states have no exits", () => {
    for (const terminal of ["COMPLETED", "REJECTED", "REFUNDED", "EXPIRED"] as const) {
      expect(canTransition(terminal, "FUNDED")).toBe(false);
    }
  });
});
