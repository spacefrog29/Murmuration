/**
 * The predator: a single agent that hunts the flock.
 *
 * Behavioural model:
 *   - Picks the nearest prey as a target.
 *   - Holds that target for `predatorTargetLockTime` seconds, OR until the
 *     target escapes beyond `predatorTargetRadius`, OR until the target is
 *     removed (killed). Then re-picks.
 *   - Steers toward the target using the standard Reynolds pattern, but with
 *     its own (faster) maxSpeed and (lower) maxForce. The lower maxForce is
 *     deliberate: it gives the predator a wider turning circle than the prey,
 *     producing the characteristic "swoop, miss, peel away, come round again"
 *     behaviour of a real hunting hawk.
 *
 * No flocking among predators — each one hunts independently. In v1 there's
 * only ever one anyway. If we add packs later, that's where pack logic would
 * go.
 */

import type { Boid } from './Boid.ts';
import type { Vec2 } from './Vector2.ts';
import { v, length, limit, setMagnitude, sub } from './Vector2.ts';
import type { Config } from '../config.ts';

export interface Predator {
  position: Vec2;
  velocity: Vec2;
  /** Index of currently locked prey, or -1 if no target. */
  targetIndex: number;
  /** Seconds the current target has been held. Reset to 0 on re-pick. */
  targetAge: number;
}

export const createPredator = (position: Vec2, velocity: Vec2): Predator => ({
  position,
  velocity,
  targetIndex: -1,
  targetAge: 0,
});

/**
 * Pick the nearest prey as a new target. Returns the index, or -1 if no prey.
 */
function pickTarget(predator: Predator, prey: Boid[]): number {
  if (prey.length === 0) return -1;
  let bestIdx = -1;
  let bestDistSq = Infinity;
  for (let i = 0; i < prey.length; i++) {
    const dx = prey[i].position.x - predator.position.x;
    const dy = prey[i].position.y - predator.position.y;
    const dSq = dx * dx + dy * dy;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Decide whether to re-pick a target. Returns the (possibly new) target index.
 *
 * Re-pick conditions:
 *   - No current target (initial state)
 *   - Current target index out of bounds (target was killed and array shrank)
 *   - Lock time exceeded
 *   - Target has escaped beyond targetRadius
 */
function refreshTarget(
  predator: Predator,
  prey: Boid[],
  config: Config,
): number {
  // No prey at all → no target
  if (prey.length === 0) return -1;

  // No current target, or index now invalid
  if (predator.targetIndex < 0 || predator.targetIndex >= prey.length) {
    return pickTarget(predator, prey);
  }

  // Lock time exceeded
  if (predator.targetAge >= config.predatorTargetLockTime) {
    return pickTarget(predator, prey);
  }

  // Target escaped beyond capture radius
  const target = prey[predator.targetIndex];
  const dx = target.position.x - predator.position.x;
  const dy = target.position.y - predator.position.y;
  const dSq = dx * dx + dy * dy;
  if (dSq > config.predatorTargetRadius * config.predatorTargetRadius) {
    return pickTarget(predator, prey);
  }

  // Keep current target
  return predator.targetIndex;
}

/**
 * Update one predator: pick/refresh target, compute steering, integrate.
 *
 * Caller is responsible for keeping predator inside world bounds (we use the
 * same soft-wall pattern as prey).
 */
export function updatePredator(
  predator: Predator,
  prey: Boid[],
  worldWidth: number,
  worldHeight: number,
  dt: number,
  config: Config,
): void {
  // --- Target selection ---
  const newTarget = refreshTarget(predator, prey, config);
  if (newTarget !== predator.targetIndex) {
    predator.targetIndex = newTarget;
    predator.targetAge = 0;
  } else {
    predator.targetAge += dt;
  }

  // --- Steering ---
  let accelX = 0;
  let accelY = 0;

  if (predator.targetIndex >= 0) {
    const target = prey[predator.targetIndex];
    // Vector to target → desired velocity at predatorMaxSpeed
    const toTarget = v(
      target.position.x - predator.position.x,
      target.position.y - predator.position.y,
    );
    if (length(toTarget) > 0) {
      const desired = setMagnitude(toTarget, config.predatorMaxSpeed);
      const steer = limit(sub(desired, predator.velocity), config.predatorMaxForce);
      accelX += steer.x;
      accelY += steer.y;
    }
  }

  // --- Wall avoidance (same pattern as prey) ---
  const wall = predatorWallForce(predator, worldWidth, worldHeight, config);
  accelX += wall.x * config.wallWeight;
  accelY += wall.y * config.wallWeight;

  // --- Integrate ---
  predator.velocity.x += accelX * dt;
  predator.velocity.y += accelY * dt;

  // Clamp to predator speed range. We use predator-specific maxSpeed; the
  // prey's minSpeed is too low to look right on the larger agent, so we
  // give the predator its own floor of 0.6 × maxSpeed.
  const speed = length(predator.velocity);
  const predatorMinSpeed = config.predatorMaxSpeed * 0.6;
  if (speed > config.predatorMaxSpeed) {
    const s = config.predatorMaxSpeed / speed;
    predator.velocity.x *= s;
    predator.velocity.y *= s;
  } else if (speed < predatorMinSpeed && speed > 0) {
    const s = predatorMinSpeed / speed;
    predator.velocity.x *= s;
    predator.velocity.y *= s;
  } else if (speed === 0) {
    const angle = Math.random() * Math.PI * 2;
    predator.velocity.x = Math.cos(angle) * predatorMinSpeed;
    predator.velocity.y = Math.sin(angle) * predatorMinSpeed;
  }

  predator.position.x += predator.velocity.x * dt;
  predator.position.y += predator.velocity.y * dt;
}

function predatorWallForce(
  predator: Predator,
  worldWidth: number,
  worldHeight: number,
  config: Config,
): Vec2 {
  const margin = config.wallMargin;
  let desiredX = 0;
  let desiredY = 0;
  let active = false;

  if (predator.position.x < margin) {
    desiredX = config.predatorMaxSpeed;
    active = true;
  } else if (predator.position.x > worldWidth - margin) {
    desiredX = -config.predatorMaxSpeed;
    active = true;
  }

  if (predator.position.y < margin) {
    desiredY = config.predatorMaxSpeed;
    active = true;
  } else if (predator.position.y > worldHeight - margin) {
    desiredY = -config.predatorMaxSpeed;
    active = true;
  }

  if (!active) return v(0, 0);

  const desired = setMagnitude(v(desiredX, desiredY), config.predatorMaxSpeed);
  return limit(sub(desired, predator.velocity), config.predatorMaxForce);
}
