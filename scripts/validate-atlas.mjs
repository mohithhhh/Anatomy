#!/usr/bin/env node
/**
 * Integrity check for the downloaded model data (adapted from human-atlas).
 * Verifies part and concept counts, unique IDs, every binary buffer, index ranges,
 * finite vertex positions, concept membership, and the total triangle count.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lock = JSON.parse(await readFile(join(root, "data/models.lock.json"), "utf8"));
const dir = join(root, "public/models", lock.version);
const atlas = JSON.parse(await readFile(join(dir, "atlas.json"), "utf8"));

assert.equal(atlas.parts.length, 2234, "part count");
assert.equal(atlas.concepts.length, 3432, "concept count");
assert.equal(atlas.chunks.length, 15, "chunk count");

const ids = new Set(atlas.parts.map((p) => p.id));
assert.equal(ids.size, atlas.parts.length, "part IDs are unique");

const buffers = await Promise.all(
  atlas.chunks.map(async (chunk) => {
    assert.ok(chunk.gzip, "every chunk has a gzip file");
    const raw = gunzipSync(await readFile(join(dir, chunk.gzip.split("/").pop())));
    assert.equal(raw.length, chunk.bytes, `${chunk.gzip} decompressed size`);
    return raw;
  }),
);

let triangles = 0;
for (const part of atlas.parts) {
  assert.ok(part.name.trim() && part.name !== "-", `${part.id}: has a name`);
  assert.match(part.conceptId, /^FMA\d+$/, `${part.id}: has an FMA concept`);
  assert.ok(part.system, `${part.id}: has a system`);
  const buffer = buffers[part.chunk];
  assert.ok(buffer, `${part.id}: chunk exists`);
  assert.ok(part.indices + part.indexCount * 4 <= buffer.length, `${part.id}: indices in range`);
  const positions = new Float32Array(
    buffer.buffer,
    buffer.byteOffset + part.positions,
    part.vertexCount * 3,
  );
  const indices = new Uint32Array(buffer.buffer, buffer.byteOffset + part.indices, part.indexCount);
  assert.ok(indices.length >= 3, `${part.id}: has triangles`);
  for (const index of indices) assert.ok(index < part.vertexCount, `${part.id}: vertex index`);
  for (const value of positions) assert.ok(Number.isFinite(value), `${part.id}: finite position`);
  triangles += part.indexCount / 3;
}

for (const concept of atlas.concepts) {
  assert.ok(concept.elements.length > 0, `${concept.id}: has elements`);
  for (const id of concept.elements) assert.ok(ids.has(id), `${concept.id}: missing part ${id}`);
}

assert.equal(triangles, atlas.triangles, "triangle total");
console.log(
  `Atlas ${lock.version}: ${ids.size} meshes, ${atlas.concepts.length} concepts, ` +
    `${triangles.toLocaleString("en")} triangles and all ${buffers.length} buffers verified.`,
);
