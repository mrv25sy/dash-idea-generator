import { describe, expect, it } from "vitest";

import { isUuid, MAX_GOAL_TITLE, validateGoalInput } from "@/lib/goals";

describe("Goal entry rules", () => {
  it("accepts a plain goal with no date", () => {
    expect(validateGoalInput({ title: "  Run a 10k  ", targetDate: "" })).toEqual({
      ok: true,
      value: { title: "Run a 10k", targetDate: null },
    });
  });

  it("collapses the spaces inside a goal", () => {
    const result = validateGoalInput({ title: "Read   more   books" });
    expect(result.ok && result.value.title).toBe("Read more books");
  });

  it("rejects an empty or whitespace-only goal", () => {
    expect(validateGoalInput({ title: "   " })).toEqual({
      ok: false,
      error: "Write your goal first.",
    });
  });

  it(`rejects a goal longer than ${MAX_GOAL_TITLE} characters`, () => {
    const result = validateGoalInput({ title: "a".repeat(MAX_GOAL_TITLE + 1) });
    expect(result).toEqual({
      ok: false,
      error: `Keep your goal under ${MAX_GOAL_TITLE} characters.`,
    });
  });

  it("accepts a real date", () => {
    expect(validateGoalInput({ title: "Ship Dash", targetDate: "2026-12-31" })).toEqual({
      ok: true,
      value: { title: "Ship Dash", targetDate: "2026-12-31" },
    });
  });

  it("rejects a date that does not exist", () => {
    expect(validateGoalInput({ title: "Ship Dash", targetDate: "2026-02-30" })).toEqual({
      ok: false,
      error: "Pick a real date.",
    });
  });

  it("rejects a malformed date", () => {
    expect(validateGoalInput({ title: "Ship Dash", targetDate: "31/12/2026" })).toEqual({
      ok: false,
      error: "Pick a real date.",
    });
  });

  it("only accepts well-formed goal ids", () => {
    expect(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(true);
    expect(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c330")).toBe(false);
    expect(isUuid("drop table goals")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});
