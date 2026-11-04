// Adapted from human-atlas (MIT). See LICENSE.human-atlas.

/** Tells a tap apart from an orbit, pinch, pan or cancelled touch sequence. */
export class PointerTap {
  private active = new Map<number, { x: number; y: number; threshold: number }>();
  private blocked = false;

  down(id: number, x: number, y: number, threshold: number): void {
    if (this.active.size === 0) this.blocked = false;
    this.active.set(id, { x, y, threshold });
    if (this.active.size > 1) this.blocked = true;
  }

  move(id: number, x: number, y: number): void {
    const start = this.active.get(id);
    if (start && Math.hypot(x - start.x, y - start.y) > start.threshold) this.blocked = true;
  }

  /** Returns true when the released pointer completed a tap. */
  up(id: number, x: number, y: number): boolean {
    this.move(id, x, y);
    const tap = this.active.has(id) && this.active.size === 1 && !this.blocked;
    this.active.delete(id);
    return tap;
  }

  cancel(id: number): void {
    this.active.delete(id);
    this.blocked = true;
  }
}
