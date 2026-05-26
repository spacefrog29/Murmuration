/**
 * Mouse pointer as a steering influence on the flock.
 *
 * Two modes, mutually exclusive:
 *   - 'attract': prey steer toward the cursor (left mouse button)
 *   - 'repel':   prey steer away from the cursor (right mouse button)
 *   - 'off':     no influence
 *
 * The "repel" mode shares its mechanics with the predator flee force —
 * 1/distance-weighted away vector, Reynolds steering — but it's wired
 * separately because the cursor isn't a Predator (no target lock, no
 * hunting, no rendering as a dart).
 *
 * Architecturally: the InputController owns the pointer state and the
 * DOM event wiring; the Flock reads `pointer.mode` and `pointer.position`
 * each frame and applies a force.
 */

import type { Boid } from './Boid.ts';
import type { Vec2 } from './Vector2.ts';
import { v, length, limit, setMagnitude, sub } from './Vector2.ts';
import type { Config } from '../config.ts';

export type PointerMode = 'off' | 'attract' | 'repel';

export interface Pointer {
  position: Vec2;
  mode: PointerMode;
}

export const createPointer = (): Pointer => ({
  position: v(0, 0),
  mode: 'off',
});

/**
 * Compute the steering force from the pointer on a single prey boid.
 * Returns zero vector when the pointer is off or out of range.
 *
 * Attract and repel share the same magnitude logic — the only difference
 * is the sign of the direction vector.
 */
export function pointerForce(
  self: Boid,
  pointer: Pointer,
  config: Config,
): Vec2 {
  if (pointer.mode === 'off') return v(0, 0);

  const dx = pointer.position.x - self.position.x;
  const dy = pointer.position.y - self.position.y;
  const dSq = dx * dx + dy * dy;
  const radiusSq = config.pointerInfluenceRadius * config.pointerInfluenceRadius;

  if (dSq >= radiusSq || dSq === 0) return v(0, 0);

  const dist = Math.sqrt(dSq);

  // Direction: toward cursor for attract, away for repel.
  // 1/distance weighting so the effect feels strongest up close.
  const sign = pointer.mode === 'attract' ? 1 : -1;
  const dirX = (sign * dx / dist) / dist;
  const dirY = (sign * dy / dist) / dist;

  const desired = setMagnitude(v(dirX, dirY), config.maxSpeed);
  return limit(sub(desired, self.velocity), config.maxForce);
}
