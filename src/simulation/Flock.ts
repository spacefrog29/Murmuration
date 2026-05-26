/**
 * The Flock: owns all prey boids AND predators, runs the per-frame update.
 *
 * Update pipeline (per frame):
 *   1. Predators update first (target selection + steering + integration).
 *      They read the current state of prey before prey react — this gives a
 *      stable snapshot.
 *   2. Prey gather neighbour stats and compute sep / ali / coh + flee + wall
 *      forces into accel[]. Double-buffered: all reads from current state,
 *      writes deferred.
 *   3. Prey integrate (apply accel → velocity → position).
 *   4. Kill check: if removeOnKill is on, prey inside killRadius of any
 *      predator are removed (swap-and-pop to keep it O(1) per kill).
 */

import type { Boid } from './Boid.ts';
import { createBoid } from './Boid.ts';
import type { Predator } from './Predator.ts';
import { createPredator, updatePredator } from './Predator.ts';
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
import { flee } from './flee.ts';

export class Flock {
  boids: Boid[] = [];
  predators: Predator[] = [];
  /** Parallel array: accumulated acceleration for the current frame, prey only. */
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

  // --- Prey population management ----------------------------------------

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

  // --- Predator management -----------------------------------------------

  /**
   * Spawn a predator at a random edge of the world, pointed toward the flock
   * centroid. Feels like the hawk arriving rather than appearing in the middle.
   */
  spawnPredator(speed: number): void {
    // Pick a random edge: 0=top, 1=right, 2=bottom, 3=left
    const edge = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;
    switch (edge) {
      case 0: x = Math.random() * this.worldWidth; y = 0; break;
      case 1: x = this.worldWidth; y = Math.random() * this.worldHeight; break;
      case 2: x = Math.random() * this.worldWidth; y = this.worldHeight; break;
      case 3: x = 0; y = Math.random() * this.worldHeight; break;
    }

    // Aim toward flock centroid, or screen centre if no flock.
    let targetX = this.worldWidth / 2;
    let targetY = this.worldHeight / 2;
    if (this.boids.length > 0) {
      let sumX = 0, sumY = 0;
      for (const b of this.boids) { sumX += b.position.x; sumY += b.position.y; }
      targetX = sumX / this.boids.length;
      targetY = sumY / this.boids.length;
    }
    const dirX = targetX - x;
    const dirY = targetY - y;
    const dirLen = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    const vel = v((dirX / dirLen) * speed, (dirY / dirLen) * speed);

    this.predators.push(createPredator(v(x, y), vel));
  }

  removeAllPredators(): void {
    this.predators.length = 0;
  }

  // --- World ----------------------------------------------------------------

  setWorldSize(width: number, height: number): void {
    this.worldWidth = width;
    this.worldHeight = height;
  }

  /**
   * Step the simulation forward by `dt` seconds.
   */
  step(dt: number, config: Config): void {
    // --- Predators move first (snapshot of prey before prey react) ---
    for (const predator of this.predators) {
      updatePredator(predator, this.boids, this.worldWidth, this.worldHeight, dt, config);
    }

    // --- Prey: phase 1, compute accelerations from current state ---
    for (let i = 0; i < this.boids.length; i++) {
      const boid = this.boids[i];
      const a = this.accel[i];
      a.x = 0;
      a.y = 0;

      gatherNeighbourStats(boid, i, this.boids, config, this.statsScratch);

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

      // Flee — added on top of the three rules so alignment/cohesion still
      // operate. That's what produces the wave through the flock.
      if (this.predators.length > 0) {
        const f = flee(boid, this.predators, config);
        a.x += f.x * config.fleeWeight;
        a.y += f.y * config.fleeWeight;
      }

      const wall = this.wallForce(boid, config);
      a.x += wall.x * config.wallWeight;
      a.y += wall.y * config.wallWeight;
    }

    // --- Prey: phase 2, integrate ---
    for (let i = 0; i < this.boids.length; i++) {
      const boid = this.boids[i];
      const a = this.accel[i];

      boid.velocity.x += a.x * dt;
      boid.velocity.y += a.y * dt;

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

      boid.position.x += boid.velocity.x * dt;
      boid.position.y += boid.velocity.y * dt;
    }

    // --- Kill check ---
    if (config.removeOnKill && this.predators.length > 0) {
      this.processKills(config);
    }
  }

  /**
   * Remove any prey within killRadius of any predator. Uses swap-and-pop so
   * removal is O(1) per kill. Also invalidates predator target indices that
   * pointed past the surviving array — predator code re-picks next frame.
   */
  private processKills(config: Config): void {
    const killSq = config.predatorKillRadius * config.predatorKillRadius;
    // Iterate backwards so swap-and-pop doesn't skip elements.
    for (let i = this.boids.length - 1; i >= 0; i--) {
      const boid = this.boids[i];
      let killed = false;
      for (let p = 0; p < this.predators.length; p++) {
        const pred = this.predators[p];
        const dx = pred.position.x - boid.position.x;
        const dy = pred.position.y - boid.position.y;
        if (dx * dx + dy * dy < killSq) {
          killed = true;
          // Reset this predator's target — it just ate.
          pred.targetIndex = -1;
          pred.targetAge = 0;
          break;
        }
      }
      if (killed) {
        // Swap-and-pop; accel array stays parallel.
        const last = this.boids.length - 1;
        if (i !== last) {
          this.boids[i] = this.boids[last];
          this.accel[i] = this.accel[last];
        }
        this.boids.pop();
        this.accel.pop();
      }
    }
  }

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
