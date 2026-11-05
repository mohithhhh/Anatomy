export type SystemId =
  | "skeletal"
  | "muscular"
  | "cardiac"
  | "sensory"
  | "arterial"
  | "venous"
  | "nervous"
  | "respiratory"
  | "digestive"
  | "urinary"
  | "lymphatic"
  | "endocrine"
  | "reproductive"
  | "integumentary"
  | "connective"
  | "pregnancy";

/** One source mesh. Byte offsets point into the chunk buffer named by `chunk`. */
export interface Part {
  id: string;
  name: string;
  conceptId: string;
  system: SystemId;
  chunk: number;
  positions: number;
  normals: number;
  indices: number;
  vertexCount: number;
  indexCount: number;
  bounds: [number[], number[]];
  /** Uberon ID from the source, when the mesh was given its own concept on load. */
  uberon?: string;
}

/** A named FMA concept. It may group several meshes (`elements` are part IDs). */
export interface Concept {
  id: string;
  name: string;
  elements: string[];
}

export interface Chunk {
  url: string;
  bytes: number;
  gzip?: string;
  gzipBytes?: number;
}

export interface Atlas {
  version: string;
  sex?: string;
  source?: string;
  scope?: string;
  parts: Part[];
  concepts: Concept[];
  chunks: Chunk[];
  triangles: number;
}
