/**
 * Uniform spatial grid for neighbour lookup.
 *
 * The world is divided into square cells of side `cellSize` (set to the
 * perception radius each frame). A boid can only have neighbours in its own
 * cell or the 8 surrounding ones, so a neighbour scan touches ~9 cells
 * instead of the whole flock. O(n²) becomes roughly O(n).
 *
 * Storage is a counting sort into flat Int32Arrays (no per-cell arrays, no
 * per-frame allocation once the arrays are big enough):
 *
 *   cellStart[c] .. cellStart[c + 1]   — the range of `entries` for cell c
 *   entries[k]                          — a boid index
 *
 * Boids can drift slightly outside the world bounds (soft walls), so cell
 * coordinates are clamped to the edge cells rather than dropped.
 */

import type { Boid } from './Boid.ts';

export class SpatialGrid {
  cellSize = 1;
  cols = 1;
  rows = 1;

  /** cellStart has length cols*rows + 1; cellStart[c+1] - cellStart[c] = count in cell c */
  cellStart = new Int32Array(2);
  /** Boid indices sorted by cell. Length >= boid count. */
  entries = new Int32Array(0);

  /** Scratch: cell index of each boid, filled during rebuild. */
  private cellOfBoid = new Int32Array(0);
  /** Scratch: per-cell write position during the scatter pass. */
  private cursor = new Int32Array(0);

  /**
   * Re-bucket every boid. Call once per frame before any neighbour queries.
   * `cellSize` should be >= the largest query radius (perceptionRadius).
   */
  rebuild(boids: Boid[], cellSize: number, worldWidth: number, worldHeight: number): void {
    this.cellSize = Math.max(1, cellSize);
    this.cols = Math.max(1, Math.ceil(worldWidth / this.cellSize));
    this.rows = Math.max(1, Math.ceil(worldHeight / this.cellSize));

    const cellCount = this.cols * this.rows;
    const n = boids.length;

    if (this.cellStart.length < cellCount + 1) {
      this.cellStart = new Int32Array(cellCount + 1);
    }
    if (this.entries.length < n) {
      this.entries = new Int32Array(n);
      this.cellOfBoid = new Int32Array(n);
    }

    const cellStart = this.cellStart;
    const cellOfBoid = this.cellOfBoid;
    cellStart.fill(0, 0, cellCount + 1);

    // Pass 1: count boids per cell. Counts are stored at cellStart[c + 1]
    // so the prefix sum below lands them in the right place.
    for (let i = 0; i < n; i++) {
      const c = this.cellIndexAt(boids[i].position.x, boids[i].position.y);
      cellOfBoid[i] = c;
      cellStart[c + 1]++;
    }

    // Pass 2: prefix sum → cellStart[c] = first entry slot for cell c
    for (let c = 0; c < cellCount; c++) {
      cellStart[c + 1] += cellStart[c];
    }

    // Pass 3: scatter boid indices into entries. `cursor` starts as a copy of
    // cellStart and advances as each cell fills, so cellStart stays intact.
    if (this.cursor.length < cellCount) {
      this.cursor = new Int32Array(cellCount);
    }
    const cursor = this.cursor;
    cursor.set(cellStart.subarray(0, cellCount));

    const entries = this.entries;
    for (let i = 0; i < n; i++) {
      entries[cursor[cellOfBoid[i]]++] = i;
    }
  }

  /** Column of a world x coordinate, clamped to the grid. */
  colAt(x: number): number {
    const c = Math.floor(x / this.cellSize);
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c;
  }

  /** Row of a world y coordinate, clamped to the grid. */
  rowAt(y: number): number {
    const r = Math.floor(y / this.cellSize);
    return r < 0 ? 0 : r >= this.rows ? this.rows - 1 : r;
  }

  cellIndexAt(x: number, y: number): number {
    return this.rowAt(y) * this.cols + this.colAt(x);
  }
}
