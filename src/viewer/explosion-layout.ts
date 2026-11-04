// Adapted from human-atlas (MIT). See LICENSE.human-atlas.

export interface LayoutCell {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutInput {
  id: string;
  bounds: [number[], number[]];
}

export interface ExplosionLayout {
  cells: Map<string, LayoutCell>;
  width: number;
  height: number;
}

/**
 * Pack the visible meshes into a flat "inventory" of rows. Every projected bounding box gets its
 * own cell, so no two pieces overlap. `aspect` is the viewport width / height.
 */
export function createExplosionLayout(parts: readonly LayoutInput[], aspect = 1): ExplosionLayout {
  const cards = parts.map((p) => ({
    id: p.id,
    width: Math.max(0.035, (p.bounds[1][0] ?? 0) - (p.bounds[0][0] ?? 0)) + 0.04,
    height: Math.max(0.035, (p.bounds[1][1] ?? 0) - (p.bounds[0][1] ?? 0)) + 0.04,
  }));
  const area = cards.reduce((sum, c) => sum + c.width * c.height, 0);
  const maxWidth = Math.max(0.3, ...cards.map((c) => c.width));
  const targetWidth = Math.max(
    maxWidth,
    Math.sqrt(area * Math.max(0.5, Math.min(1.5, aspect))) * 1.18,
  );
  cards.sort((a, b) => b.height - a.height || a.id.localeCompare(b.id));

  const cells = new Map<string, LayoutCell>();
  let x = 0;
  let y = 0;
  let row = 0;
  let usedWidth = 0;
  for (const card of cards) {
    if (x > 0 && x + card.width > targetWidth) {
      x = 0;
      y += row;
      row = 0;
    }
    cells.set(card.id, {
      x: x + card.width / 2,
      y: -y - card.height / 2,
      width: card.width,
      height: card.height,
    });
    x += card.width;
    usedWidth = Math.max(usedWidth, x);
    row = Math.max(row, card.height);
  }
  const height = y + row;
  for (const cell of cells.values()) {
    cell.x -= usedWidth / 2;
    cell.y += height / 2;
  }
  return { cells, width: usedWidth, height };
}
