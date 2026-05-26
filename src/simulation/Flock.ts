/**
 * The Flock: owns all prey boids, predators, and a reference to the input pointer.
 *
 * Update pipeline (per frame):
 *   1. Predators update first (target selection + steering + integration).
 *   2. Prey: phase 1 — compute accelerations from current state. Includes
 *      separation/alignment/cohesion, flee (from predators), pointer force,
 *      and wall force. Double-buffered.
 *   3. Prey: phase 2 — apply accel → velocity → position.
 *   4. Kill check (if removeOnKill is on).
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
import type { Pointer } from './Pointer.ts';
import { pointerForce } from './Pointer.ts';

export class Flock {
  boids: Boid[] = [];
  predators: Predator[] = [];
  private accel: Vec2[] = [];
  private statsScratch: NeighbourStats = {
    velSumX: 0, velSumY: 0, perceptionCount: 0,
    posSumX: 0, posSumY: 0,
    sepX: 0, sepY: 0, separationCount: 0,
  };

  constructor(
    private worldWidth: number,
    private worldHeight: number,
    /** Shared by reference with InputController; mutations there are visible here. */
    private pointer: Pointer,
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

  spawnPredator(speed: number): void {
    const edge = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;
    switch (edge) {
      case 0: x = Math.random() * this.worldWidth; y = 0; break;
      case 1: x = this.worldWidth; y = Math.random() * this.worldHeight; break;
      case 2: x = Math.random() * this.worldWidth; y = this.worldHeight; break;
      case 3: x = 0; y = Math.random() * this.worldHeight; break;
    }

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

  /** Read-only access for renderer / UI. */
  getPointer(): Pointer {
    return this.pointer;
  }

  step(dt: number, config: Config): void {
    // --- Predators first ---
    for (const predator of this.predators) {
      updatePredator(predator, this.boids, this.worldWidth, this.worldHeight, dt, config);
    }

    // --- Prey phase 1: accumulate forces ---
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

      if (this.predators.length > 0) {
        const f = flee(boid, this.predators, config);
        a.x += f.x * config.fleeWeight;
        a.y += f.y * config.fleeWeight;
      }

      // Mouse pointer force (attract or repel). Returns zero when pointer is 'off'.
      const pf = pointerForce(boid, this.pointer, config);
      a.x += pf.x * config.pointerWeight;
      a.y += pf.y * config.pointerWeight;

      const wall = this.wallForce(boid, config);
      a.x += wall.x * config.wallWeight;
      a.y += wall.y * config.wallWeight;
    }

    // --- Prey phase 2: integrate ---
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

    if (config.removeOnKill && this.predators.length > 0) {
      this.processKills(config);
    }
  }

  private processKills(config: Config): void {
    const killSq = config.predatorKillRadius * config.predatorKillRadius;
    for (let i = this.boids.length - 1; i >= 0; i--) {
      const boid = this.boids[i];
      let killed = false;
      for (let p = 0; p < this.predators.length; p++) {
        const pred = this.predators[p];
        const dx = pred.position.x - boid.position.x;
        const dy = pred.position.y - boid.position.y;
        if (dx * dx + dy * dy < killSq) {
          killed = true;
          pred.targetIndex = -1;
          pred.targetAge = 0;
          break;
        }
      }
      if (killed) {
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
