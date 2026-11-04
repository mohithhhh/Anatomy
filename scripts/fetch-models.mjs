#!/usr/bin/env node
/**
 * Download the pinned anatomy model data into public/models/<version>/.
 *
 * - One lock file per body (data/models*.lock.json); every file is verified against its SHA-256.
 * - Verified files are kept in .cache/models/<version>/ so repeat runs (and CI caches) skip the network.
 * - MODELS_BASE_URL overrides the source, e.g. to use our own mirror.
 *
 * Usage: node scripts/fetch-models.mjs [--force]
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Node's fetch only honours HTTPS_PROXY when NODE_USE_ENV_PROXY is set. Re-run once with it.
const proxied = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxied && !process.env.NODE_USE_ENV_PROXY) {
  const child = spawnSync(process.execPath, ["--no-warnings", ...process.argv.slice(1)], {
    stdio: "inherit",
    env: { ...process.env, NODE_USE_ENV_PROXY: "1" },
  });
  process.exit(child.status ?? 1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const force = process.argv.includes("--force");

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

async function verified(path, file) {
  if (!existsSync(path)) return false;
  const buffer = await readFile(path);
  return buffer.length === file.bytes && sha256(buffer) === file.sha256;
}

async function download(url, attempts = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt >= attempts)
        throw new Error(`Could not download ${url}: ${error.message}`, { cause: error });
      const wait = 2 ** attempt * 1000;
      console.warn(`  retrying ${url.split("/").pop()} in ${wait / 1000}s (${error.message})`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

async function fetchBody(lock) {
  const baseUrl = process.env.MODELS_BASE_URL ?? lock.source.baseUrl;
  const outDir = join(root, "public/models", lock.version);
  const cacheDir = join(root, ".cache/models", lock.version);
  await mkdir(outDir, { recursive: true });
  await mkdir(cacheDir, { recursive: true });
  let downloaded = 0;
  let totalBytes = 0;

  // Download a few files at a time; there are 16 in total.
  const queue = [...lock.files];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let file = queue.shift(); file; file = queue.shift()) {
        const target = join(outDir, file.name);
        const cached = join(cacheDir, file.name);
        totalBytes += file.bytes;
        if (!force && (await verified(target, file))) continue;
        if (!force && (await verified(cached, file))) {
          await copyFile(cached, target);
          continue;
        }
        const buffer = await download(new URL(file.name, baseUrl).href);
        if (buffer.length !== file.bytes || sha256(buffer) !== file.sha256) {
          throw new Error(
            `Checksum mismatch for ${file.name}. Refusing to use unverified model data.`,
          );
        }
        await writeFile(`${cached}.tmp`, buffer);
        await rename(`${cached}.tmp`, cached);
        await copyFile(cached, target);
        downloaded++;
      }
    }),
  );

  const mb = (totalBytes / 1e6).toFixed(1);
  console.log(
    `Model data ${lock.version}: ${lock.files.length} files verified (${mb} MB, ${downloaded} downloaded).`,
  );
}

async function main() {
  const { readdir } = await import("node:fs/promises");
  const names = (await readdir(join(root, "data"))).filter((n) => /^models.*\.lock\.json$/.test(n));
  const locks = await Promise.all(
    names.map(async (n) => JSON.parse(await readFile(join(root, "data", n), "utf8"))),
  );
  for (const lock of locks) await fetchBody(lock);
  // Remove model folders from older pinned versions so they never ship.
  const keep = new Set(locks.map((l) => l.version));
  for (const entry of await readdir(join(root, "public/models"))) {
    if (!keep.has(entry)) await rm(join(root, "public/models", entry), { recursive: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
