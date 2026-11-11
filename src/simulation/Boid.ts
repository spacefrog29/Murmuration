/**
 * A boid: a point with velocity. Nothing else by design.
 *
 * Heading is derived from velocity at render time. Acceleration is transient
 * (computed each frame, applied, discarded) and lives on the Flock as a
 * parallel array, not on the Boid itself — this is the double-buffer.
 */

import type { Vec2 } from './Vector2.ts';

export interface Boid {
  position: Vec2;
  velocity: Vec2;
}

/** Factory: create a new boid with random initial state */
export const createBoid = (position: Vec2, velocity: Vec2): Boid => ({
  position,
  velocity,
});

/** Revive: reset position/velocity for recycling an old boid */
export const reviveBoid = (boid: Boid): void => {
  const angle = Math.random() * Math.PI * 2;
  const speed = Math.random() * 50 + 10; // 10-60px/s random starting speed
  boid.position.x = Math.random() * 3000;
  boid.position.y = Math.random() * 3000;
  boid.velocity.x = Math.cos(angle) * speed;
  boid.velocity.y = Math.sin(angle) * speed;
};
