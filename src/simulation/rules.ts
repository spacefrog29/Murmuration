/**
 * The three Reynolds boid rules + a shared neighbour scan.
 *
 * Each rule follows the same pattern:
 *   desired = (target vector, normalised to maxSpeed)
 *   steer   = desired - currentVelocity
 *   steer   = limit(steer, maxForce)
 *
 * That "desired minus current" subtraction is the whole secret to smooth
 * boid motion — it turns "I want to go that way" into "nudge my heading
 * a little toward that way each frame." Skip it and boids snap-rotate
 * like turret-mounted guns.
 *
 * All three rules currently do a naive O(n) inner scan; the caller does
 * an outer O(n) over boids, giving O(n²) total. That's deliberate — it's
 * the reference implementation. The seam for plugging in a spatial grid
 * later is `findNeighbours` below.
 */

import type { Boid } from './Boid.ts';
import type { Vec2 } from './Vector2.ts';
import { v, length, limit, setMagnitude, sub } from './Vector2.ts';
import type { Config } from '../config.ts';

/**
 * Scratch object holding pre-scanned neighbour data, so all three rules can
 * share one pass over the flock instead of each doing their own. Filled by
 * `gatherNeighbourStats` and consumed by the rule functions.
 */
export interface NeighbourStats {
  // Alignment: sum of neighbour velocities + count (within perceptionRadius)
  velSumX: number;
  velSumY: number;
  perceptionCount: number;

  // Cohesion: sum of neighbour positions + count (within perceptionRadius)
  posSumX: number;
  posSumY: number;
  // cohesionCount === perceptionCount, kept separate for clarity if we ever
  // want separate radii for alignment vs cohesion.

  // Separation: weighted "away" vector + count (within separationRadius)
  sepX: number;
  sepY: number;
  separationCount: number;
}

const makeStats = (): NeighbourStats => ({
  velSumX: 0,
  velSumY: 0,
  perceptionCount: 0,
  posSumX: 0,
  posSumY: 0,
  sepX: 0,
  sepY: 0,
  separationCount: 0,
});

/**
 * Single pass over the flock to gather everything the three rules need
 * for one boid. Returns the same scratch object passed in (reused across
 * frames to avoid allocation).
 */
export function gatherNeighbourStats(
  self: Boid,
  selfIndex: number,
  boids: Boid[],
  config: Config,
  out: NeighbourStats,
): NeighbourStats {
  // Reset
  out.velSumX = 0;
  out.velSumY = 0;
  out.perceptionCount = 0;
  out.posSumX = 0;
  out.posSumY = 0;
  out.sepX = 0;
  out.sepY = 0;
  out.separationCount = 0;

  const percSq = config.perceptionRadius * config.perceptionRadius;
  const sepSq = config.separationRadius * config.separationRadius;

  for (let i = 0; i < boids.length; i++) {
    if (i === selfIndex) continue;
    const other = boids[i];
    const dx = other.position.x - self.position.x;
    const dy = other.position.y - self.position.y;
    const dSq = dx * dx + dy * dy;

    if (dSq >= percSq) continue; // outside perception, skip entirely

    // Alignment + cohesion accumulators
    out.velSumX += other.velocity.x;
    out.velSumY += other.velocity.y;
    out.posSumX += other.position.x;
    out.posSumY += other.position.y;
    out.perceptionCount++;

    // Separation: only if inside the (smaller) separation radius
    if (dSq < sepSq && dSq > 0) {
      // Vector pointing AWAY from neighbour, weighted by 1/distance.
      // 1/distance is achieved by dividing the unit vector by distance again,
      // i.e. (dx, dy) / dSq * length — but simpler: away_unit / distance.
      // We just take (-dx, -dy) / dSq, which gives away-direction scaled by 1/d.
      const dist = Math.sqrt(dSq);
      out.sepX += (-dx / dist) / dist;
      out.sepY += (-dy / dist) / dist;
      out.separationCount++;
    }
  }

  return out;
}

// --- The three rules --------------------------------------------------------

/**
 * Alignment: steer toward the average velocity of neighbours within
 * perceptionRadius.
 */
export function alignment(self: Boid, stats: NeighbourStats, config: Config): Vec2 {
  if (stats.perceptionCount === 0) return v(0, 0);

  // Average velocity
  const avgX = stats.velSumX / stats.perceptionCount;
  const avgY = stats.velSumY / stats.perceptionCount;

  // Normalise to maxSpeed — "go that direction at full tilt"
  const desired = setMagnitude(v(avgX, avgY), config.maxSpeed);

  // Steer = desired - current, clamped
  return limit(sub(desired, self.velocity), config.maxForce);
}

/**
 * Cohesion: steer toward the centroid of neighbours within perceptionRadius.
 */
export function cohesion(self: Boid, stats: NeighbourStats, config: Config): Vec2 {
  if (stats.perceptionCount === 0) return v(0, 0);

  // Centroid
  const cx = stats.posSumX / stats.perceptionCount;
  const cy = stats.posSumY / stats.perceptionCount;

  // Vector from self to centroid, normalised to maxSpeed
  const toCentre = v(cx - self.position.x, cy - self.position.y);
  if (length(toCentre) === 0) return v(0, 0);
  const desired = setMagnitude(toCentre, config.maxSpeed);

  return limit(sub(desired, self.velocity), config.maxForce);
}

/**
 * Separation: steer away from neighbours within separationRadius, weighted
 * by 1/distance (closer = stronger push).
 *
 * The raw sum is already in "away, weighted by 1/distance" form thanks to
 * gatherNeighbourStats. We average it, normalise to maxSpeed, then apply
 * the standard steering subtraction.
 */
export function separation(self: Boid, stats: NeighbourStats, config: Config): Vec2 {
  if (stats.separationCount === 0) return v(0, 0);

  const avgX = stats.sepX / stats.separationCount;
  const avgY = stats.sepY / stats.separationCount;

  if (avgX === 0 && avgY === 0) return v(0, 0);
  const desired = setMagnitude(v(avgX, avgY), config.maxSpeed);

  return limit(sub(desired, self.velocity), config.maxForce);
}
