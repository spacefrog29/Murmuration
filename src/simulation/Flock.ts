/**
 * The Flock: owns all boids, runs the per-frame update.
 *
 * Update pipeline (per frame, per boid):
 *   1. Gather neighbour stats in one pass (O(n) per boid → O(n²) total)
 *   2. Compute sep / ali / coh / wall forces into accel[]
 *   3. After all boids processed, apply: velocity += accel * dt, clamp speed
 *   4. Integrate position: position += velocity * dt
 *
 * Steps 1–2 and 3–4 are split into two passes so every boid reads the *same*
 * snapshot of the world — that's the double buffer. Order-independent,
 * physically correct.
 */

import type { Boid } from './Boid.ts';
import { createBoid } from './Boid.ts';
import type { Vec2 } from './Vector2.ts';
import { v, length, limit, setMagnitude, sub } from './Vector2.ts';
import type { Config } from '../config.ts';
import {
  gatherNeighbourStats,
  alignment,
  cohesion,
  separation,
} from './rules.ts';
import type { NeighbourStats } from './rules.ts';

export class Flock {
  boids: Boid[] = [];
  /** Parallel array: accumulated acceleration for the current frame. */
  private accel: Vec2[] = [];
  /** Single reusable scratch object — refilled each boid, each frame. */
  private statsScratch: NeighbourStats = {
    velSumX: 0, velSumY: 0, perceptionCount: 0,
    posSumX: 0, posSumY: 0,
    sepX: 0, sepY: 0, separationCount: 0,
  };

  constructor(
    private worldWidth: number,
    private worldHeight: number,
  ) {}

  /** (Re)populate the flock with `count` boids at random positions/velocities. */
  populate(count: number, initialSpeed: number): void {
    this.boids = [];
    this.accel = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.boids.push(
        createBoid(
          v(Math.random() * this.worldWidth, Math.random() * this.worldHeight),
          v(Math.cos(angle) * initialSpeed, Math.sin(angle) * initialSpeed),
        ),
      );
      this.accel.push(v(0, 0));
    }
  }

  /** Adjust population without resetting existing boids. */
  resize(count: number, initialSpeed: number): void {
    while (this.boids.length < count) {
      const angle = Math.random() * Math.PI * 2;
      this.boids.push(
        createBoid(
          v(Math.random() * this.worldWidth, Math.random() * this.worldHeight),
          v(Math.cos(angle) * initialSpeed, Math.sin(angle) * initialSpeed),
        ),
      );
      this.accel.push(v(0, 0));
    }
    if (this.boids.length > count) {
      this.boids.length = count;
      this.accel.length = count;
    }
  }

  setWorldSize(width: number, height: number): void {
    this.worldWidth = width;
    this.worldHeight = height;
  }

  /**
   * Step the simulation forward by `dt` seconds.
   * Reads `config` live so slider changes take effect immediately.
   */
  step(dt: number, config: Config): void {
    // --- Phase 1: compute accelerations from snapshot of current state ---
    for (let i = 0; i < this.boids.length; i++) {
      const boid = this.boids[i];
      const a = this.accel[i];
      a.x = 0;
      a.y = 0;

      // One pass over all other boids, gathering stats for all three rules.
      gatherNeighbourStats(boid, i, this.boids, config, this.statsScratch);

      // Each rule returns a steering force already clamped to maxForce.
      // We multiply by its weight and accumulate.
      if (config.enableSeparation) {
        const f = separation(boid, this.statsScratch, config);
        a.x += f.x * config.separationWeight;
        a.y += f.y * config.separationWeight;
      }
      if (config.enableAlignment) {
        const f = alignment(boid, this.statsScratch, config);
        a.x += f.x * config.alignmentWeight;
        a.y += f.y * config.alignmentWeight;
      }
      if (config.enableCohesion) {
        const f = cohesion(boid, this.statsScratch, config);
        a.x += f.x * config.cohesionWeight;
        a.y += f.y * config.cohesionWeight;
      }

      // Wall avoidance (steer-away force near edges)
      const wall = this.wallForce(boid, config);
      a.x += wall.x * config.wallWeight;
      a.y += wall.y * config.wallWeight;
    }

    // --- Phase 2: integrate ---
    for (let i = 0; i < this.boids.length; i++) {
      const boid = this.boids[i];
      const a = this.accel[i];

      // velocity += acceleration * dt
      boid.velocity.x += a.x * dt;
      boid.velocity.y += a.y * dt;

      // Clamp speed to [minSpeed, maxSpeed]
      const speed = length(boid.velocity);
      if (speed > config.maxSpeed) {
        const s = config.maxSpeed / speed;
        boid.velocity.x *= s;
        boid.velocity.y *= s;
      } else if (speed < config.minSpeed && speed > 0) {
        const s = config.minSpeed / speed;
        boid.velocity.x *= s;
        boid.velocity.y *= s;
      } else if (speed === 0) {
        const angle = Math.random() * Math.PI * 2;
        boid.velocity.x = Math.cos(angle) * config.minSpeed;
        boid.velocity.y = Math.sin(angle) * config.minSpeed;
      }

      // position += velocity * dt
      boid.position.x += boid.velocity.x * dt;
      boid.position.y += boid.velocity.y * dt;
    }
  }

  /**
   * Wall avoidance using the Reynolds steering pattern.
   *
   * Within `wallMargin` of an edge, compute a desired velocity pointing inward
   * at maxSpeed, then return (desired - current) clamped to maxForce.
   */
  private wallForce(boid: Boid, config: Config): Vec2 {
    const margin = config.wallMargin;
    let desiredX = 0;
    let desiredY = 0;
    let active = false;

    if (boid.position.x < margin) {
      desiredX = config.maxSpeed;
      active = true;
    } else if (boid.position.x > this.worldWidth - margin) {
      desiredX = -config.maxSpeed;
      active = true;
    }

    if (boid.position.y < margin) {
      desiredY = config.maxSpeed;
      active = true;
    } else if (boid.position.y > this.worldHeight - margin) {
      desiredY = -config.maxSpeed;
      active = true;
    }

    if (!active) return v(0, 0);

    const desired = setMagnitude(v(desiredX, desiredY), config.maxSpeed);
    const steer = sub(desired, boid.velocity);
    return limit(steer, config.maxForce);
  }
}
