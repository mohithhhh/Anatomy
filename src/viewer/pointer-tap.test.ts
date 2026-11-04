import { describe, expect, it } from "vitest";
import { PointerTap } from "./pointer-tap";

describe("PointerTap", () => {
  it("accepts a small movement as a tap", () => {
    const tap = new PointerTap();
    tap.down(1, 10, 10, 5);
    expect(tap.up(1, 12, 11)).toBe(true);
  });

  it("rejects a drag", () => {
    const tap = new PointerTap();
    tap.down(1, 10, 10, 5);
    tap.move(1, 40, 10);
    expect(tap.up(1, 10, 10)).toBe(false);
  });

  it("rejects multitouch until every pointer is released", () => {
    const tap = new PointerTap();
    tap.down(1, 10, 10, 12);
    tap.down(2, 20, 20, 12);
    expect(tap.up(2, 20, 20)).toBe(false);
    expect(tap.up(1, 10, 10)).toBe(false);
    tap.down(1, 10, 10, 5);
    expect(tap.up(1, 10, 10)).toBe(true);
  });

  it("rejects a cancelled pointer", () => {
    const tap = new PointerTap();
    tap.down(1, 10, 10, 5);
    tap.cancel(1);
    expect(tap.up(1, 10, 10)).toBe(false);
  });
});
