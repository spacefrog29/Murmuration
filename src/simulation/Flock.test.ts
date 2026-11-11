import { describe, expect, it } from 'vitest';
import { config as defaults } from '../config.ts';
import { Flock } from './Flock.ts';
import { createPointer } from './Pointer.ts';
import { length } from './Vector2.ts';

const W = 800;
const H = 600;

function makeFlock(count: number): Flock {
  const flock = new Flock(W, H, createPointer());
  flock.populate(count, 50);
  return flock;
}

describe('Flock population', () => {
  it('populate creates the requested number of boids inside the world', () => {
    const flock = makeFlock(100);
    expect(flock.boids).toHaveLength(100);
    for (const b of flock.boids) {
      expect(b.position.x).toBeGreaterThanOrEqual(0);
      expect(b.position.x).toBeLessThanOrEqual(W);
      expect(b.position.y).toBeGreaterThanOrEqual(0);
      expect(b.position.y).toBeLessThanOrEqual(H);
    }
  });

  it('resize grows without disturbing existing boids', () => {
    const flock = makeFlock(10);
    const first = flock.boids[0];
    const firstPos = { ...first.position };

    flock.resize(50, 50);

    expect(flock.boids).toHaveLength(50);
    expect(flock.boids[0]).toBe(first);
    expect(flock.boids[0].position).toEqual(firstPos);
  });

  it('resize shrinks and terminates (regression: used to loop forever)', () => {
    const flock = makeFlock(5000);
    flock.resize(5, 50);
    expect(flock.boids).toHaveLength(5);

    flock.resize(0, 50);
    expect(flock.boids).toHaveLength(0);
  });

  it('resize to the same size is a no-op', () => {
    const flock = makeFlock(20);
    const snapshot = flock.boids.slice();
    flock.resize(20, 50);
    expect(flock.boids).toEqual(snapshot);
  });

  it('stepping after a resize does not throw and keeps every boid moving', () => {
    const flock = makeFlock(300);
    flock.resize(40, 50);
    flock.resize(120, 50);

    for (let i = 0; i < 10; i++) flock.step(1 / 60, defaults);

    expect(flock.boids).toHaveLength(120);
    for (const b of flock.boids) {
      expect(Number.isFinite(b.position.x)).toBe(true);
      expect(Number.isFinite(b.position.y)).toBe(true);
    }
  });
});

describe('Flock.step', () => {
  it('clamps every boid speed into [minSpeed, maxSpeed]', () => {
    const flock = makeFlock(200);
    for (let i = 0; i < 30; i++) flock.step(1 / 60, defaults);

    for (const b of flock.boids) {
      const speed = length(b.velocity);
      expect(speed).toBeGreaterThanOrEqual(defaults.minSpeed - 1e-6);
      expect(speed).toBeLessThanOrEqual(defaults.maxSpeed + 1e-6);
    }
  });

  it('is order-independent: boids see the same snapshot regardless of index', () => {
    // Build two flocks with identical boids in opposite array order. After one
    // step, each boid should have moved identically — proving phase 1 never
    // reads positions that phase 2 has already updated.
    const a = makeFlock(150);
    const b = makeFlock(150);
    const n = a.boids.length;
    for (let i = 0; i < n; i++) {
      const src = a.boids[i];
      const dst = b.boids[n - 1 - i];
      dst.position.x = src.position.x;
      dst.position.y = src.position.y;
      dst.velocity.x = src.velocity.x;
      dst.velocity.y = src.velocity.y;
    }

    a.step(1 / 60, defaults);
    b.step(1 / 60, defaults);

    for (let i = 0; i < n; i++) {
      const fromA = a.boids[i];
      const fromB = b.boids[n - 1 - i];
      expect(fromB.position.x).toBeCloseTo(fromA.position.x, 9);
      expect(fromB.position.y).toBeCloseTo(fromA.position.y, 9);
    }
  });

  it('wall force keeps the flock near the world over time', () => {
    const flock = makeFlock(200);
    for (let i = 0; i < 600; i++) flock.step(1 / 60, defaults); // 10 simulated seconds

    const slack = defaults.wallMargin * 2;
    for (const b of flock.boids) {
      expect(b.position.x).toBeGreaterThan(-slack);
      expect(b.position.x).toBeLessThan(W + slack);
      expect(b.position.y).toBeGreaterThan(-slack);
      expect(b.position.y).toBeLessThan(H + slack);
    }
  });
});

describe('Predators', () => {
  it('spawn and remove', () => {
    const flock = makeFlock(50);
    flock.spawnPredator(100);
    flock.spawnPredator(100);
    expect(flock.predators).toHaveLength(2);
    flock.removeAllPredators();
    expect(flock.predators).toHaveLength(0);
  });

  it('removeOnKill reduces the flock when a predator catches prey', () => {
    const flock = makeFlock(100);
    flock.spawnPredator(100);
    // Drop the predator right on top of boid 0.
    flock.predators[0].position.x = flock.boids[0].position.x;
    flock.predators[0].position.y = flock.boids[0].position.y;

    flock.step(1 / 60, { ...defaults, removeOnKill: true });
    expect(flock.boids.length).toBeLessThan(100);
  });
});
