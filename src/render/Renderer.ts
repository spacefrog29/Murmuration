/**
 * Canvas 2D renderer for the flock.
 *
 * Prey: small filled triangles. Predators: larger, stretched, red triangles.
 * Both rotated to face their velocity vector.
 */

import type { Flock } from '../simulation/Flock.ts';
import type { Boid } from '../simulation/Boid.ts';
import type { Predator } from '../simulation/Predator.ts';
import type { Config } from '../config.ts';

const BOID_SIZE = 6;
const PREDATOR_LENGTH = 16;      // forward extent of the stretched triangle
const PREDATOR_HALF_WIDTH = 5;   // perpendicular extent

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

    if (config.trailMode) {
      ctx.fillStyle = 'rgba(10, 14, 20, 0.12)';
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = '#0a0e14';
      ctx.fillRect(0, 0, width, height);
    }

    for (const boid of flock.boids) {
      this.drawBoid(boid, config);
    }

    for (const predator of flock.predators) {
      this.drawPredator(predator);
      if (config.showPredatorTarget && predator.targetIndex >= 0 && predator.targetIndex < flock.boids.length) {
        this.drawTargetLine(predator, flock.boids[predator.targetIndex]);
      }
    }

    // Debug overlays last (on top)
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
      const hue = ((heading + Math.PI) / (Math.PI * 2)) * 360;
      ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
    } else {
      ctx.fillStyle = '#d8dee9';
    }

    ctx.beginPath();
    ctx.moveTo(BOID_SIZE, 0);
    ctx.lineTo(-BOID_SIZE, BOID_SIZE * 0.6);
    ctx.lineTo(-BOID_SIZE, -BOID_SIZE * 0.6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private drawPredator(predator: Predator): void {
    const ctx = this.ctx;
    const heading = Math.atan2(predator.velocity.y, predator.velocity.x);

    ctx.save();
    ctx.translate(predator.position.x, predator.position.y);
    ctx.rotate(heading);

    // Stretched dart shape, red. Pointed tip well forward, narrow tail.
    ctx.fillStyle = '#e64545';
    ctx.beginPath();
    ctx.moveTo(PREDATOR_LENGTH, 0);
    ctx.lineTo(-PREDATOR_LENGTH * 0.5, PREDATOR_HALF_WIDTH);
    ctx.lineTo(-PREDATOR_LENGTH * 0.3, 0);
    ctx.lineTo(-PREDATOR_LENGTH * 0.5, -PREDATOR_HALF_WIDTH);
    ctx.closePath();
    ctx.fill();

    // Subtle outline for visibility against busy flock
    ctx.strokeStyle = 'rgba(255, 200, 200, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  private drawTargetLine(predator: Predator, target: Boid): void {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(230, 69, 69, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(predator.position.x, predator.position.y);
    ctx.lineTo(target.position.x, target.position.y);
    ctx.stroke();
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
    ctx.lineTo(boid.position.x + boid.velocity.x * 0.1, boid.position.y + boid.velocity.y * 0.1);
    ctx.stroke();
  }
}
