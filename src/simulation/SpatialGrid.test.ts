import { describe, expect, it } from 'vitest';
import type { Boid } from './Boid.ts';
import { createBoid } from './Boid.ts';
import { SpatialGrid } from './SpatialGrid.ts';
import { v } from './Vector2.ts';

const boidAt = (x: number, y: number): Boid => createBoid(v(x, y), v(0, 0));

/** All boid indices stored in a given cell. */
function cellContents(grid: SpatialGrid, cell: number): number[] {
  const out: number[] = [];
  for (let k = grid.cellStart[cell]; k < grid.cellStart[cell + 1]; k++) {
    out.push(grid.entries[k]);
  }
  return out.sort((a, b) => a - b);
}

describe('SpatialGrid', () => {
  it('sizes the grid from world size and cell size', () => {
    const grid = new SpatialGrid();
    grid.rebuild([], 50, 1000, 500);
    expect(grid.cols).toBe(20);
    expect(grid.rows).toBe(10);
    expect(grid.cellStart[grid.cols * grid.rows]).toBe(0);
  });

  it('places each boid in exactly one cell', () => {
    const boids = [boidAt(10, 10), boidAt(60, 10), boidAt(10, 60), boidAt(75, 75)];
    const grid = new SpatialGrid();
    grid.rebuild(boids, 50, 100, 100);

    expect(grid.cols).toBe(2);
    expect(grid.rows).toBe(2);
    expect(cellContents(grid, 0)).toEqual([0]); // top-left
    expect(cellContents(grid, 1)).toEqual([1]); // top-right
    expect(cellContents(grid, 2)).toEqual([2]); // bottom-left
    expect(cellContents(grid, 3)).toEqual([3]); // bottom-right
    expect(grid.cellStart[4]).toBe(boids.length);
  });

  it('groups boids sharing a cell', () => {
    const boids = [boidAt(1, 1), boidAt(40, 40), boidAt(99, 99), boidAt(20, 30)];
    const grid = new SpatialGrid();
    grid.rebuild(boids, 50, 100, 100);
    expect(cellContents(grid, 0)).toEqual([0, 1, 3]);
    expect(cellContents(grid, 3)).toEqual([2]);
  });

  it('clamps boids outside the world into edge cells instead of dropping them', () => {
    const boids = [boidAt(-500, -500), boidAt(5000, 5000), boidAt(-1, 50)];
    const grid = new SpatialGrid();
    grid.rebuild(boids, 50, 100, 100);

    expect(cellContents(grid, 0)).toEqual([0]); // far top-left → cell (0,0)
    expect(cellContents(grid, 3)).toEqual([1]); // far bottom-right → cell (1,1)
    expect(cellContents(grid, 2)).toEqual([2]); // x<0, y in row 1 → cell (0,1)
    expect(grid.cellStart[4]).toBe(3);
  });

  it('reuses buffers across rebuilds and handles shrinking populations', () => {
    const grid = new SpatialGrid();
    const many = Array.from({ length: 100 }, (_, i) => boidAt(i, i));
    grid.rebuild(many, 10, 100, 100);
    const entriesBefore = grid.entries;

    grid.rebuild(many.slice(0, 3), 10, 100, 100);
    expect(grid.entries).toBe(entriesBefore); // no reallocation when shrinking
    expect(grid.cellStart[grid.cols * grid.rows]).toBe(3);
  });

  it('never produces a cell size below 1', () => {
    const grid = new SpatialGrid();
    grid.rebuild([boidAt(0, 0)], 0, 10, 10);
    expect(grid.cellSize).toBe(1);
    expect(grid.cols).toBe(10);
  });
});
