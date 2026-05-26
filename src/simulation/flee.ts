/**
 * The flee rule: prey react to predators.
 *
 * For each predator within `predatorFleeRadius`, compute an away vector
 * weighted by 1/distance (same pattern as separation). Sum across all
 * predators, normalise to maxSpeed, apply standard Reynolds steering.
 *
 * Notes:
 *   - Lives in its own file because it operates over the predator array,
 *     not the prey array. Keeps `rules.ts` focused on prey-prey interactions.
 *   - Weighted by 1/distance like separation, so distant predators barely
 *     register and close ones overwhelm the other rules. This produces the
 *     "wave" effect: the boid nearest the hawk panics hardest, its alignment
 *     drags neighbours along, and a coherent ripple propagates through the
 *     flock.
 *   - Returns a force already clamped to maxForce. Caller multiplies by
 *     fleeWeight before adding to acceleration.
 *   - O(prey × predators) total. With one predator this is O(n). Fine.
 */

import type { Boid } from './Boid.ts';
import type { Predator } from './Predator.ts';
import type { Vec2 } from './Vector2.ts';
import { v, length, limit, setMagnitude, sub } from './Vector2.ts';
import type { Config } from '../config.ts';

export function flee(self: Boid, predators: Predator[], config: Config): Vec2 {
  if (predators.length === 0) return v(0, 0);

  const fleeRadiusSq = config.predatorFleeRadius * config.predatorFleeRadius;
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (let i = 0; i < predators.length; i++) {
    const predator = predators[i];
    const dx = predator.position.x - self.position.x;
    const dy = predator.position.y - self.position.y;
    const dSq = dx * dx + dy * dy;

    if (dSq >= fleeRadiusSq || dSq === 0) continue;

    const dist = Math.sqrt(dSq);
    // Away unit vector divided by distance again → 1/distance weighting.
    sumX += (-dx / dist) / dist;
    sumY += (-dy / dist) / dist;
    count++;
  }

  if (count === 0) return v(0, 0);

  const avg = v(sumX / count, sumY / count);
  if (length(avg) === 0) return v(0, 0);
  const desired = setMagnitude(avg, config.maxSpeed);
  return limit(sub(desired, self.velocity), config.maxForce);
}
