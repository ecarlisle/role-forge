import { describe, it, expect } from "vitest";
import { isValidTransition } from "../src/listing-status";

describe("isValidTransition", () => {
  it("allows transition from new to saved", () => {
    expect(isValidTransition("new", "saved")).toBe(true);
  });

  it("allows transition from new to dismissed", () => {
    expect(isValidTransition("new", "dismissed")).toBe(true);
  });

  it("allows transition from new to flagged", () => {
    expect(isValidTransition("new", "flagged")).toBe(true);
  });

  it("allows transition from saved to dismissed", () => {
    expect(isValidTransition("saved", "dismissed")).toBe(true);
  });

  it("allows transition from saved to flagged", () => {
    expect(isValidTransition("saved", "flagged")).toBe(true);
  });

  it("allows transition from dismissed to saved", () => {
    expect(isValidTransition("dismissed", "saved")).toBe(true);
  });

  it("allows transition from dismissed to flagged", () => {
    expect(isValidTransition("dismissed", "flagged")).toBe(true);
  });

  it("allows transition from flagged to saved", () => {
    expect(isValidTransition("flagged", "saved")).toBe(true);
  });

  it("allows transition from flagged to dismissed", () => {
    expect(isValidTransition("flagged", "dismissed")).toBe(true);
  });

  it("disallows transition from new to new", () => {
    expect(isValidTransition("new", "new")).toBe(false);
  });

  it("disallows transition from saved to saved", () => {
    expect(isValidTransition("saved", "saved")).toBe(false);
  });

  it("disallows transition from dismissed to dismissed", () => {
    expect(isValidTransition("dismissed", "dismissed")).toBe(false);
  });

  it("disallows transition from flagged to flagged", () => {
    expect(isValidTransition("flagged", "flagged")).toBe(false);
  });

  it("disallows transition from saved to new", () => {
    expect(isValidTransition("saved", "new")).toBe(false);
  });

  it("disallows transition from dismissed to new", () => {
    expect(isValidTransition("dismissed", "new")).toBe(false);
  });

  it("disallows transition from flagged to new", () => {
    expect(isValidTransition("flagged", "new")).toBe(false);
  });
});
