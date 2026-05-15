/**
 * Canvas 2D renderer for the flock.
 *
 * One filled triangle per boid, rotated to face its velocity vector.
 * Uses ctx.save/translate/rotate/restore for clean code — fine for a few
 * thousand boids. If we need to scale beyond that, swap to manual rotation
 * maths (two trig calls + matrix-style transform per boid).
 */

import type { Flock } from '../simulation/Flock.ts';
import type { Boid } from '../simulation/Boid.ts';
import type { Config } from '../config.ts';

const BOID_SIZE = 6; // half-length of the triangle, in pixels

export class Renderer {
  constructor(
    private ctx: CanvasRenderingContext2D,
    private getWidth: () => number,
    private getHeight: () => number,
  ) {}

  draw(flock: Flock, config: Config): void {
    const ctx = this.ctx;
    const width = this.getWidth();
    const height = this.getHeight();

    // Background: hard clear OR translucent overlay for motion trails.
    if (config.trailMode) {
      ctx.fillStyle = 'rgba(10, 14, 20, 0.12)';
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = '#0a0e14';
      ctx.fillRect(0, 0, width, height);
    }

    // Boids
    for (const boid of flock.boids) {
      this.drawBoid(boid, config);
    }

    // Debug overlays (drawn last so they sit on top)
    if (config.showPerceptionRadius && flock.boids.length > 0) {
      this.drawPerception(flock.boids[0], config);
    }
    if (config.showVelocityVectors) {
      for (const boid of flock.boids) this.drawVelocity(boid);
    }
  }

  private drawBoid(boid: Boid, config: Config): void {
    const ctx = this.ctx;
    const heading = Math.atan2(boid.velocity.y, boid.velocity.x);

    ctx.save();
    ctx.translate(boid.position.x, boid.position.y);
    ctx.rotate(heading);

    if (config.colourByHeading) {
      // Map heading from [-PI, PI] to [0, 360] hue
      const hue = ((heading + Math.PI) / (Math.PI * 2)) * 360;
      ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
    } else {
      ctx.fillStyle = '#d8dee9';
    }

    // Triangle pointing along +x (which is now the heading after rotate)
    ctx.beginPath();
    ctx.moveTo(BOID_SIZE, 0);
    ctx.lineTo(-BOID_SIZE, BOID_SIZE * 0.6);
    ctx.lineTo(-BOID_SIZE, -BOID_SIZE * 0.6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private drawPerception(boid: Boid, config: Config): void {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(120, 200, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(boid.position.x, boid.position.y, config.perceptionRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 120, 120, 0.35)';
    ctx.beginPath();
    ctx.arc(boid.position.x, boid.position.y, config.separationRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawVelocity(boid: Boid): void {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(boid.position.x, boid.position.y);
    // Scale velocity down for display
    ctx.lineTo(boid.position.x + boid.velocity.x * 0.1, boid.position.y + boid.velocity.y * 0.1);
    ctx.stroke();
  }
}
