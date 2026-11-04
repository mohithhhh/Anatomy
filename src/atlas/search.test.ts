import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import lock from "../../data/models.lock.json";
import { indexAtlas, type AtlasIndex } from "./atlas-index";
import { displayName, searchConcepts } from "./search";
import type { Atlas } from "./types";

let index: AtlasIndex;
beforeAll(() => {
  const url = new URL(`../../public/models/${lock.version}/atlas.json`, import.meta.url);
  index = indexAtlas(JSON.parse(readFileSync(url, "utf8")) as Atlas);
});

const names = (query: string, n = 5) =>
  searchConcepts(index, query)
    .slice(0, n)
    .map((r) => r.concept.name);

describe("searchConcepts", () => {
  it("suggests common structures for an empty query", () => {
    const suggestions = names("", 20);
    expect(suggestions).toContain("heart");
    expect(suggestions).toContain("femur");
  });

  it("puts exact and prefix matches first", () => {
    expect(names("femur")[0]).toBe("femur");
    expect(names("heart")[0]).toBe("heart");
    expect(names("Kidney")[0]).toBe("kidney");
  });

  it("matches words in any order", () => {
    expect(names("biceps left", 10)).toContain("short head of left biceps brachii");
  });

  it("ignores punctuation and extra spaces", () => {
    expect(names("  left   femur! ")[0]).toBe("left femur");
  });

  it("finds a concept by FMA ID and by mesh ID", () => {
    const femur = searchConcepts(index, "femur")[0]!.concept;
    expect(searchConcepts(index, femur.id.toLowerCase())[0]!.concept.id).toBe(femur.id);
    const part = index.atlas.parts.find((p) => p.id.endsWith("M"))!;
    expect(searchConcepts(index, part.id)[0]!.concept.id).toBe(part.conceptId);
  });

  it("returns nothing for nonsense", () => {
    expect(searchConcepts(index, "zzqx")).toEqual([]);
  });

  it("capitalises display names", () => {
    expect(displayName("left femur")).toBe("Left femur");
  });
});
