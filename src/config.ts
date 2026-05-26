/**
 * Central tunable configuration.
 *
 * Everything that affects how the simulation looks or behaves lives here.
 * lil-gui mutates this object in place; the simulation reads from it every
 * frame, so changes take effect immediately with no rebuild.
 */

export type HuntingStrategy = 'solo' | 'spreading';
// Future modes: 'encircling' | 'driving'

export interface Config {
  // --- Population ---
  boidCount: number;

  // --- Prey perception ---
  perceptionRadius: number;
  separationRadius: number;

  // --- Prey motion ---
  maxSpeed: number;
  minSpeed: number;
  maxForce: number;

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

  // --- Predator (individual) ---
  predatorMaxSpeed: number;
  predatorMaxForce: number;
  predatorFleeRadius: number;
  predatorTargetRadius: number;
  predatorTargetLockTime: number;
  predatorKillRadius: number;

  // --- Predator (pack behaviour) ---
  huntingStrategy: HuntingStrategy;
  predatorSeparationRadius: number;   // how close predators tolerate each other; coordination radius, NOT flock-relative
  predatorSeparationWeight: number;   // strength of mutual repulsion in 'spreading' mode

  // --- Flee ---
  fleeWeight: number;
  removeOnKill: boolean;

  // --- Mouse pointer ---
  pointerInfluenceRadius: number;
  pointerWeight: number;
  showPointerRadius: boolean;

  // --- Debug ---
  trailMode: boolean;
  colourByHeading: boolean;
  showPerceptionRadius: boolean;
  showVelocityVectors: boolean;
  showPredatorTarget: boolean;
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

  predatorMaxSpeed: 230,
  predatorMaxForce: 100,
  predatorFleeRadius: 140,
  predatorTargetRadius: 400,
  predatorTargetLockTime: 2.0,
  predatorKillRadius: 8,

  huntingStrategy: 'spreading',
  predatorSeparationRadius: 350,
  predatorSeparationWeight: 1.5,

  fleeWeight: 3.5,
  removeOnKill: false,

  pointerInfluenceRadius: 200,
  pointerWeight: 3.0,
  showPointerRadius: true,

  trailMode: false,
  colourByHeading: false,
  showPerceptionRadius: false,
  showVelocityVectors: false,
  showPredatorTarget: false,
  paused: false,
};
