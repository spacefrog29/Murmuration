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

export const createBoid = (position: Vec2, velocity: Vec2): Boid => ({
  position,
  velocity,
});
