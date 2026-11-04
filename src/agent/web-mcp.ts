// WebMCP tools, adapted from human-atlas (MIT). See src/viewer/LICENSE.human-atlas.
// In browsers that support WebMCP, AI agents can search the atlas and open structures for the
// person using the page. Everything here is optional; the visible UI works without it.

import type { AtlasIndex } from "@/atlas/atlas-index";
import { displayName, searchConcepts } from "@/atlas/search";
import type { Concept } from "@/atlas/types";

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean };
  execute: (input: unknown) => unknown;
}

function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Expected an object.");
  }
  return input as Record<string, unknown>;
}

export function atlasTools(index: AtlasIndex, inspect: (concept: Concept) => void): AgentTool[] {
  return [
    {
      name: "find_anatomy",
      description:
        "Find anatomical structures in this 3D atlas by name (any word order), FMA ID or mesh ID. Returns up to 30 matches, best first.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", minLength: 1 } },
        required: ["query"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute(input) {
        const { query } = record(input);
        if (typeof query !== "string" || !query.trim()) {
          throw new Error("A non-empty query is required.");
        }
        return searchConcepts(index, query, 30).map(({ concept }) => ({
          id: concept.id,
          name: displayName(concept.name),
          pieces: concept.elements.length,
        }));
      },
    },
    {
      name: "inspect_anatomical_structure",
      description:
        "Select a structure by its FMA ID, fly the 3D camera to it and open its detail panel for the user.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute(input) {
        const { id } = record(input);
        if (typeof id !== "string") throw new Error("An FMA identifier is required.");
        const concept = index.concepts.get(id.trim().toUpperCase());
        if (!concept) throw new Error("That structure is not in this atlas.");
        inspect(concept);
        return {
          id: concept.id,
          name: displayName(concept.name),
          selectedPieces: concept.elements.length,
        };
      },
    },
  ];
}

interface ModelContext {
  registerTool: (
    tool: AgentTool,
    options?: { signal: AbortSignal },
  ) => void | { unregister?: () => void } | Promise<unknown>;
}

/** Register the tools if the browser exposes WebMCP. Returns a cleanup function. */
export function registerAtlasTools(
  index: AtlasIndex,
  inspect: (concept: Concept) => void,
): () => void {
  const context =
    (navigator as Navigator & { modelContext?: ModelContext }).modelContext ??
    (document as Document & { modelContext?: ModelContext }).modelContext;
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  const handles: { unregister?: () => void }[] = [];
  for (const tool of atlasTools(index, inspect)) {
    try {
      const result = context.registerTool(tool, { signal: lifecycle.signal });
      if (result instanceof Promise) result.catch(() => {});
      else if (result && typeof result === "object") handles.push(result);
    } catch {
      // Optional browser capability.
    }
  }
  return () => {
    lifecycle.abort();
    for (const handle of handles) handle.unregister?.();
  };
}
