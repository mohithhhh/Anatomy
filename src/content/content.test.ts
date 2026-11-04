import { describe, expect, it } from "vitest";
import { loadFixture } from "../test/atlas-fixture.ts";
import { parentFromName } from "./content.ts";
import { mirrorName, sideOf } from "./laterality.ts";
import { regionByName, type RegionId } from "./regions.ts";

const { index, content } = loadFixture();
const item = (name: string) => {
  const found = content.items.find((i) => i.name.toLowerCase() === name.toLowerCase());
  if (!found) throw new Error(`No study item named ${name}`);
  return found;
};

describe("study items", () => {
  it("has one item per named mesh concept, without the body surface", () => {
    expect(content.items.length).toBeGreaterThan(1600);
    expect(content.items.every((i) => i.system !== "integumentary")).toBe(true);
    const parts = content.items.reduce((n, i) => n + i.partIds.length, 0);
    expect(parts).toBe(index.atlas.parts.filter((p) => p.system !== "integumentary").length);
  });

  it("merges a structure split into several meshes", () => {
    expect(item("Left optic nerve").partIds.length).toBe(2);
  });
});

describe("regions", () => {
  const expected: [string, RegionId][] = [
    ["Left femur", "lower_limb"],
    ["Right tibia", "lower_limb"],
    ["Left humerus", "upper_limb"],
    ["Right scaphoid", "upper_limb"],
    ["Left clavicle", "upper_limb"],
    ["Frontal bone", "head_neck"],
    ["Mandible", "head_neck"],
    ["Hyoid bone", "head_neck"],
    ["Left lens", "head_neck"],
    ["Brachium of right superior colliculus", "head_neck"],
    ["Tarsal plate of left lower eyelid", "head_neck"],
    ["Left first rib", "thorax"],
    ["Trachea", "thorax"],
    ["Small cardiac vein", "thorax"],
    ["Left brachiocephalic vein", "thorax"],
    ["Stomach", "abdomen"],
    ["Left kidney", "abdomen"],
    ["Abdominal aorta", "abdomen"],
    ["Urinary bladder", "pelvis"],
    ["Prostate", "pelvis"],
    ["Right hip bone", "pelvis"],
    ["Left coccygeus", "pelvis"],
    ["Sacrum", "back"],
    ["First lumbar vertebra", "back"],
    ["Left lumbar rotator", "back"],
  ];
  for (const [name, region] of expected) {
    it(`${name} → ${region}`, () => expect(item(name).region).toBe(region));
  }

  it("gives every item a region and covers every region", () => {
    const regions = new Set(content.items.map((i) => i.region));
    expect(regions.size).toBe(7);
  });

  it("does not read 'head of' or 'neck of' as the head and neck region", () => {
    expect(regionByName("Long head of left biceps brachii")).toBe("upper_limb");
    expect(regionByName("neck of femur")).toBe("lower_limb");
  });

  it("collects all regions a group spans", () => {
    const aorta = index.atlas.concepts.find((c) => c.name === "aorta");
    if (aorta) expect(content.regionsOfConcept(aorta.id).length).toBeGreaterThan(1);
  });
});

describe("hierarchy", () => {
  it("finds a meaningful parent and siblings", () => {
    const head = item("Long head of left biceps brachii");
    expect(head.parentName).toBe("Left biceps brachii");
    expect(parentFromName("Branch of left anterior choroidal artery to posterior limb")).toBe(
      "Left anterior choroidal artery",
    );
    expect(parentFromName("Left femur")).toBeNull();
    const siblings = content.siblings(head.conceptId).map((i) => i.name);
    expect(siblings).toContain("Short head of left biceps brachii");
  });

  it("never makes a concept its own ancestor", () => {
    for (const c of index.atlas.concepts.slice(0, 500)) {
      const crumbs = content.breadcrumb(c.id).map((a) => a.id);
      expect(crumbs).not.toContain(c.id);
    }
  });
});

describe("laterality", () => {
  it("reads and mirrors the side", () => {
    expect(sideOf("Left femur")).toBe("left");
    expect(sideOf("short head of right biceps brachii")).toBe("right");
    expect(sideOf("Heart")).toBeNull();
    expect(mirrorName("Left femur")).toBe("Right femur");
    expect(mirrorName("tendon of right levator")).toBe("tendon of left levator");
  });

  it("matches the model: the body's left is +x", () => {
    expect(item("Left femur").center[0]).toBeGreaterThan(0);
    expect(item("Right femur").center[0]).toBeLessThan(0);
  });
});
