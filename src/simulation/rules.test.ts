import { describe, expect, it } from 'vitest';
import type { Config } from '../config.ts';
import { config as defaults } from '../config.ts';
import type { Boid } from './Boid.ts';
import { createBoid } from './Boid.ts';
import type { NeighbourStats } from './rules.ts';
import { alignment, cohesion, gatherNeighbourStats, separation } from './rules.ts';
import { SpatialGrid } from './SpatialGrid.ts';
import { length, v } from './Vector2.ts';

const makeStats = (): NeighbourStats => ({
  velSumX: 0, velSumY: 0, perceptionCount: 0,
  posSumX: 0, posSumY: 0,
  sepX: 0, sepY: 0, separationCount: 0,
});

/** Reference implementation: the original O(n²) scan. */
function bruteForceStats(self: Boid, selfIndex: number, boids: Boid[], config: Config): NeighbourStats {
  const out = makeStats();
  const percSq = config.perceptionRadius ** 2;
  const sepSq = config.separationRadius ** 2;
  for (let i = 0; i < boids.length; i++) {
    if (i === selfIndex) continue;
    const other = boids[i];
    const dx = other.position.x - self.position.x;
    const dy = other.position.y - self.position.y;
    const dSq = dx * dx + dy * dy;
    if (dSq >= percSq) continue;
    out.velSumX += other.velocity.x;
    out.velSumY += other.velocity.y;
    out.posSumX += other.position.x;
    out.posSumY += other.position.y;
    out.perceptionCount++;
    if (dSq < sepSq && dSq > 0) {
      const dist = Math.sqrt(dSq);
      out.sepX += (-dx / dist) / dist;
      out.sepY += (-dy / dist) / dist;
      out.separationCount++;
    }
  }
  return out;
}

/** Deterministic pseudo-random so failures are reproducible. */
function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('gatherNeighbourStats (grid) matches brute force', () => {
  const W = 1600;
  const H = 900;
  const rand = seededRandom(42);
  const boids: Boid[] = Array.from({ length: 1500 }, () =>
    createBoid(
      // Some boids just outside the world, to exercise cell clamping.
      v(rand() * (W + 200) - 100, rand() * (H + 200) - 100),
      v(rand() * 200 - 100, rand() * 200 - 100),
    ),
  );

  it('returns identical counts and sums for every boid', () => {
    const config = { ...defaults };
    const grid = new SpatialGrid();
    grid.rebuild(boids, config.perceptionRadius, W, H);
    const scratch = makeStats();

    for (let i = 0; i < boids.length; i++) {
      const expected = bruteForceStats(boids[i], i, boids, config);
      const actual = gatherNeighbourStats(boids[i], i, boids, grid, config, scratch);
      expect(actual.perceptionCount).toBe(expected.perceptionCount);
      expect(actual.separationCount).toBe(expected.separationCount);
      expect(actual.velSumX).toBeCloseTo(expected.velSumX, 6);
      expect(actual.velSumY).toBeCloseTo(expected.velSumY, 6);
      expect(actual.posSumX).toBeCloseTo(expected.posSumX, 6);
      expect(actual.posSumY).toBeCloseTo(expected.posSumY, 6);
      expect(actual.sepX).toBeCloseTo(expected.sepX, 6);
      expect(actual.sepY).toBeCloseTo(expected.sepY, 6);
    }
  });

  it('finds neighbours across cell boundaries', () => {
    const config = { ...defaults, perceptionRadius: 50, separationRadius: 20 };
    // Two boids 10px apart, straddling the x=50 cell edge.
    const pair = [createBoid(v(45, 10), v(0, 0)), createBoid(v(55, 10), v(0, 0))];
    const grid = new SpatialGrid();
    grid.rebuild(pair, config.perceptionRadius, 200, 200);

    const stats = gatherNeighbourStats(pair[0], 0, pair, grid, config, makeStats());
    expect(stats.perceptionCount).toBe(1);
    expect(stats.separationCount).toBe(1);
    expect(stats.sepX).toBeLessThan(0); // pushed away from the neighbour on the right
  });
});

describe('steering rules', () => {
  const config = { ...defaults, maxSpeed: 100, maxForce: 10 };

  it('return zero force with no neighbours', () => {
    const self = createBoid(v(0, 0), v(10, 0));
    const stats = makeStats();
    expect(alignment(self, stats, config)).toEqual({ x: 0, y: 0 });
    expect(cohesion(self, stats, config)).toEqual({ x: 0, y: 0 });
    expect(separation(self, stats, config)).toEqual({ x: 0, y: 0 });
  });

  it('never exceed maxForce', () => {
    const self = createBoid(v(0, 0), v(-100, 0));
    const stats = makeStats();
    stats.perceptionCount = 2;
    stats.velSumX = 200; stats.velSumY = 0;     // neighbours heading +x, we head -x
    stats.posSumX = 400; stats.posSumY = 400;   // centroid far away
    stats.separationCount = 1;
    stats.sepX = 5; stats.sepY = 5;

    expect(length(alignment(self, stats, config))).toBeLessThanOrEqual(config.maxForce + 1e-9);
    expect(length(cohesion(self, stats, config))).toBeLessThanOrEqual(config.maxForce + 1e-9);
    expect(length(separation(self, stats, config))).toBeLessThanOrEqual(config.maxForce + 1e-9);
  });

  it('cohesion steers toward the centroid', () => {
    const self = createBoid(v(0, 0), v(0, 0));
    const stats = makeStats();
    stats.perceptionCount = 1;
    stats.posSumX = 100; stats.posSumY = 0;
    const f = cohesion(self, stats, config);
    expect(f.x).toBeGreaterThan(0);
    expect(f.y).toBeCloseTo(0);
  });
});
