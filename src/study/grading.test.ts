import { describe, expect, it } from "vitest";
import { gradeTyped } from "./grading.ts";

describe("gradeTyped", () => {
  it("accepts exact answers ignoring case, punctuation and 'the'", () => {
    expect(gradeTyped("left humerus", "Left humerus")).toBe("correct");
    expect(gradeTyped("  The LEFT humerus! ", "Left humerus")).toBe("correct");
  });

  it("accepts small spelling slips as close", () => {
    expect(gradeTyped("left humerous", "Left humerus")).toBe("close");
    expect(gradeTyped("long head of left biceps brachi", "Long head of left biceps brachii")).toBe(
      "close",
    );
  });

  it("rejects the wrong side even when the spelling is close", () => {
    expect(gradeTyped("right humerus", "Left humerus")).toBe("wrong");
    expect(gradeTyped("humerus", "Left humerus")).toBe("wrong");
  });

  it("rejects wrong or empty answers", () => {
    expect(gradeTyped("left radius", "Left humerus")).toBe("wrong");
    expect(gradeTyped("", "Left humerus")).toBe("wrong");
  });
});
