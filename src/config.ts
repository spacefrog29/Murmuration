/**
 * Central tunable configuration.
 *
 * Everything that affects how the simulation looks or behaves lives here.
 * lil-gui mutates this object in place; the simulation reads from it every
 * frame, so changes take effect immediately with no rebuild.
 */

export interface Config {
  // --- Population ---
  boidCount: number;

  // --- Prey perception ---
  perceptionRadius: number;   // alignment + cohesion range
  separationRadius: number;   // separation kicks in below this (< perceptionRadius)

  // --- Prey motion ---
  maxSpeed: number;           // px/sec
  minSpeed: number;           // px/sec
  maxForce: number;           // cap on per-frame steering change; controls turn rate

  // --- Prey rule weights ---
  separationWeight: number;
  alignmentWeight: number;
  cohesionWeight: number;
  wallWeight: number;

  // --- Per-rule enable toggles ---
  enableSeparation: boolean;
  enableAlignment: boolean;
  enableCohesion: boolean;

  // --- Walls ---
  wallMargin: number;

  // --- Predator ---
  predatorMaxSpeed: number;       // typically 1.3× prey maxSpeed
  predatorMaxForce: number;       // typically 0.5× prey maxForce (worse turning → swoops)
  predatorFleeRadius: number;     // distance at which prey detect a predator
  predatorTargetRadius: number;   // distance beyond which predator drops lock and re-picks
  predatorTargetLockTime: number; // seconds before predator re-evaluates target
  predatorKillRadius: number;     // distance at which a kill registers (when removeOnKill on)

  // --- Flee ---
  fleeWeight: number;             // prey response strength; high (~3.5) so it dominates cohesion when close
  removeOnKill: boolean;          // if true, prey within killRadius of a predator are removed

  // --- Debug ---
  trailMode: boolean;
  colourByHeading: boolean;
  showPerceptionRadius: boolean;
  showVelocityVectors: boolean;
  showPredatorTarget: boolean;    // draw a line from predator to its current target
  paused: boolean;
}

export const config: Config = {
  boidCount: 200,

  perceptionRadius: 60,
  separationRadius: 25,

  maxSpeed: 180,
  minSpeed: 120,
  maxForce: 200,

  separationWeight: 1.5,
  alignmentWeight: 1.0,
  cohesionWeight: 1.0,
  wallWeight: 2.0,

  enableSeparation: true,
  enableAlignment: true,
  enableCohesion: true,

  wallMargin: 120,

  predatorMaxSpeed: 230,          // ~1.28× prey maxSpeed
  predatorMaxForce: 100,          // half of prey maxForce → wider turns, swoopy
  predatorFleeRadius: 140,
  predatorTargetRadius: 400,
  predatorTargetLockTime: 2.0,
  predatorKillRadius: 8,

  fleeWeight: 3.5,
  removeOnKill: false,

  trailMode: false,
  colourByHeading: false,
  showPerceptionRadius: false,
  showVelocityVectors: false,
  showPredatorTarget: false,
  paused: false,
};
