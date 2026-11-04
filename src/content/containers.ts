import type { Atlas, Concept } from "../atlas/types.ts";

/**
 * Concepts form a graph, not a tree: "long head of left biceps brachii" belongs both to "left
 * biceps brachii" and to "long head of biceps brachii" (both sides). This index finds every
 * concept whose meshes strictly contain a given concept's meshes, smallest first.
 */
export function buildContainers(atlas: Atlas): (conceptId: string) => Concept[] {
  const byId = new Map(atlas.concepts.map((c) => [c.id, c]));
  const byElement = new Map<string, Concept[]>();
  for (const concept of atlas.concepts) {
    for (const element of concept.elements) {
      const list = byElement.get(element) ?? [];
      list.push(concept);
      byElement.set(element, list);
    }
  }
  const sets = new Map<string, Set<string>>();
  const setOf = (c: Concept) => {
    let set = sets.get(c.id);
    if (!set) sets.set(c.id, (set = new Set(c.elements)));
    return set;
  };
  const cache = new Map<string, Concept[]>();

  return (conceptId) => {
    const hit = cache.get(conceptId);
    if (hit) return hit;
    const concept = byId.get(conceptId);
    if (!concept) return [];
    const size = concept.elements.length;
    const result = (byElement.get(concept.elements[0]!) ?? [])
      .filter((c) => c.elements.length > size && concept.elements.every((e) => setOf(c).has(e)))
      .toSorted((a, b) => a.elements.length - b.elements.length || a.name.localeCompare(b.name));
    cache.set(conceptId, result);
    return result;
  };
}
