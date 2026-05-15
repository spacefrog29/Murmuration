/**
 * Central tunable configuration.
 *
 * Everything that affects how the flock looks or behaves lives here. lil-gui
 * mutates this object in place each time a slider moves; the simulation reads
 * from it every frame, so changes take effect immediately with no rebuild.
 */

export interface Config {
  // Population
  boidCount: number;

  // Perception
  perceptionRadius: number;   // alignment + cohesion range
  separationRadius: number;   // separation kicks in below this (< perceptionRadius)

  // Motion limits
  maxSpeed: number;           // pixels per second
  minSpeed: number;           // pixels per second
  maxForce: number;           // cap on per-frame steering change; controls turn rate

  // Rule weights
  separationWeight: number;
  alignmentWeight: number;
  cohesionWeight: number;
  wallWeight: number;

  // Rule enable/disable — debug toggles to see contribution of each rule
  enableSeparation: boolean;
  enableAlignment: boolean;
  enableCohesion: boolean;

  // Wall behaviour
  wallMargin: number;         // distance from edge at which wall force engages

  // Debug toggles
  trailMode: boolean;
  colourByHeading: boolean;
  showPerceptionRadius: boolean;
  showVelocityVectors: boolean;
  paused: boolean;
}

export const config: Config = {
  boidCount: 200,

  perceptionRadius: 60,
  separationRadius: 25,

  // px/sec. ~3 px/frame at 60fps = 180 px/sec.
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

  trailMode: false,
  colourByHeading: false,
  showPerceptionRadius: false,
  showVelocityVectors: false,
  paused: false,
};
