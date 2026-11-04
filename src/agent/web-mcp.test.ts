import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import lock from "../../data/models.lock.json";
import { indexAtlas } from "@/atlas/atlas-index";
import type { Atlas, Concept } from "@/atlas/types";
import { atlasTools } from "./web-mcp";

const index = indexAtlas(
  JSON.parse(
    readFileSync(
      new URL(`../../public/models/${lock.version}/atlas.json`, import.meta.url),
      "utf8",
    ),
  ) as Atlas,
);

describe("WebMCP atlas tools", () => {
  let inspected: Concept | null = null;
  const [find, inspect] = atlasTools(index, (c) => {
    inspected = c;
  });

  it("finds structures, best match first", () => {
    const results = find!.execute({ query: "femur" }) as { id: string; name: string }[];
    expect(results[0]!.name).toBe("Femur");
    expect(results.length).toBeLessThanOrEqual(30);
  });

  it("rejects empty or malformed queries", () => {
    expect(() => find!.execute({ query: " " })).toThrow();
    expect(() => find!.execute("femur")).toThrow();
  });

  it("inspects a structure by FMA ID and leaves state alone on errors", () => {
    const [first] = find!.execute({ query: "heart" }) as { id: string }[];
    inspect!.execute({ id: first!.id.toLowerCase() });
    expect(inspected?.id).toBe(first!.id);
    const previous = inspected;
    expect(() => inspect!.execute({ id: "FMA0" })).toThrow();
    expect(inspected).toBe(previous);
  });
});
