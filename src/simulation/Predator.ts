/**
 * The predator: a single agent that hunts the flock.
 *
 * Behavioural model (single predator):
 *   - Picks the nearest prey as a target.
 *   - Holds that target for `predatorTargetLockTime` seconds, OR until the
 *     target escapes beyond `predatorTargetRadius`, OR until the target is
 *     removed (killed). Then re-picks.
 *   - Steers toward the target using the standard Reynolds pattern, but with
 *     its own (faster) maxSpeed and (lower) maxForce — wider turning circle,
 *     produces the characteristic "swoop, miss, peel away, come round again"
 *     of a real hunting hawk.
 *
 * Pack behaviour is selected via `config.huntingStrategy`:
 *
 *   'solo'      — predators behave independently. Multiple predators ignore
 *                 each other; both will happily lock onto the same target.
 *
 *   'spreading' — predators feel a mutual repulsion force from each other.
 *                 Composed with the chase force, this organically causes
 *                 them to spread across the flock rather than stacking on
 *                 the same target. The repulsion is the mechanical proxy
 *                 for "I can see my packmate is committed to that area, so
 *                 I'll work elsewhere" — coordination by observation, no
 *                 explicit communication channel.
 *
 *   (future)    — 'encircling' will tune the inter-predator force to push
 *                 toward opposite sides of the flock centroid rather than
 *                 just away from each other. 'driving' will introduce
 *                 predator roles.
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

// --- Target selection -------------------------------------------------------

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

function refreshTarget(predator: Predator, prey: Boid[], config: Config): number {
  if (prey.length === 0) return -1;

  if (predator.targetIndex < 0 || predator.targetIndex >= prey.length) {
    return pickTarget(predator, prey);
  }
  if (predator.targetAge >= config.predatorTargetLockTime) {
    return pickTarget(predator, prey);
  }

  const target = prey[predator.targetIndex];
  const dx = target.position.x - predator.position.x;
  const dy = target.position.y - predator.position.y;
  const dSq = dx * dx + dy * dy;
  if (dSq > config.predatorTargetRadius * config.predatorTargetRadius) {
    return pickTarget(predator, prey);
  }

  return predator.targetIndex;
}

// --- Pack forces ------------------------------------------------------------

/**
 * Mutual repulsion between predators. Identical pattern to prey separation:
 * 1/distance-weighted away vector, summed, normalised to maxSpeed, Reynolds
 * steering.
 *
 * Used by the 'spreading' hunting strategy. Predators feel each other's
 * presence and naturally drift apart, which (combined with independent chase
 * decisions) causes them to hunt different parts of the flock without any
 * explicit target coordination.
 */
function predatorRepulsion(
  self: Predator,
  selfIndex: number,
  allPredators: Predator[],
  config: Config,
): Vec2 {
  if (allPredators.length < 2) return v(0, 0);

  const radiusSq = config.predatorSeparationRadius * config.predatorSeparationRadius;
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (let i = 0; i < allPredators.length; i++) {
    if (i === selfIndex) continue;
    const other = allPredators[i];
    const dx = other.position.x - self.position.x;
    const dy = other.position.y - self.position.y;
    const dSq = dx * dx + dy * dy;
    if (dSq >= radiusSq || dSq === 0) continue;

    const dist = Math.sqrt(dSq);
    sumX += (-dx / dist) / dist;
    sumY += (-dy / dist) / dist;
    count++;
  }

  if (count === 0) return v(0, 0);

  const avg = v(sumX / count, sumY / count);
  if (length(avg) === 0) return v(0, 0);
  const desired = setMagnitude(avg, config.predatorMaxSpeed);
  return limit(sub(desired, self.velocity), config.predatorMaxForce);
}

// --- Main update -----------------------------------------------------------

/**
 * Update one predator: pick/refresh target, compute steering, integrate.
 *
 * `allPredators` and `selfIndex` are needed for pack-behaviour modes; in
 * 'solo' mode they're ignored. Passing them unconditionally keeps the
 * signature stable as we add more strategies.
 */
export function updatePredator(
  predator: Predator,
  selfIndex: number,
  allPredators: Predator[],
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

  // Chase: applies in all hunting strategies.
  if (predator.targetIndex >= 0) {
    const target = prey[predator.targetIndex];
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

  // Pack behaviour: branches on strategy. Slots for future modes here.
  switch (config.huntingStrategy) {
    case 'solo':
      // Nothing — predators ignore each other.
      break;

    case 'spreading': {
      const repulse = predatorRepulsion(predator, selfIndex, allPredators, config);
      accelX += repulse.x * config.predatorSeparationWeight;
      accelY += repulse.y * config.predatorSeparationWeight;
      break;
    }

    // case 'encircling': ... (future)
    // case 'driving':    ... (future)
  }

  // Wall avoidance.
  const wall = predatorWallForce(predator, worldWidth, worldHeight, config);
  accelX += wall.x * config.wallWeight;
  accelY += wall.y * config.wallWeight;

  // --- Integrate ---
  predator.velocity.x += accelX * dt;
  predator.velocity.y += accelY * dt;

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
