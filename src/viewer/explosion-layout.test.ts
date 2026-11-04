import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import lock from "../../data/models.lock.json";
import type { Atlas } from "@/atlas/types";
import { createExplosionLayout, type ExplosionLayout } from "./explosion-layout";

const atlas = JSON.parse(
  readFileSync(new URL(`../../public/models/${lock.version}/atlas.json`, import.meta.url), "utf8"),
) as Atlas;

function expectNoOverlap(layout: ExplosionLayout) {
  const cells = [...layout.cells.values()];
  for (let i = 0; i < cells.length; i++) {
    const a = cells[i]!;
    expect(Math.abs(a.x) + a.width / 2).toBeLessThanOrEqual(layout.width / 2 + 1e-8);
    expect(Math.abs(a.y) + a.height / 2).toBeLessThanOrEqual(layout.height / 2 + 1e-8);
    for (let j = i + 1; j < cells.length; j++) {
      const b = cells[j]!;
      const apartX = Math.abs(a.x - b.x) >= (a.width + b.width) / 2 - 1e-8;
      const apartY = Math.abs(a.y - b.y) >= (a.height + b.height) / 2 - 1e-8;
      if (!apartX && !apartY) throw new Error(`Exploded pieces overlap: ${i} and ${j}`);
    }
  }
}

describe("createExplosionLayout", () => {
  const systems = [...new Set(atlas.parts.map((p) => p.system))];
  const groups = [
    ["all parts", atlas.parts],
    ...systems.map((s) => [s, atlas.parts.filter((p) => p.system === s)] as const),
  ] as const;

  for (const [name, parts] of groups) {
    for (const aspect of [0.46, 1, 1.7]) {
      it(`packs ${name} without overlap at aspect ${aspect}`, () => {
        const layout = createExplosionLayout(parts, aspect);
        expect(layout.cells.size).toBe(parts.length);
        expectNoOverlap(layout);
      });
    }
  }

  it("handles an empty view", () => {
    expect(createExplosionLayout([]).cells.size).toBe(0);
  });
});
