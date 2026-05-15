/**
 * lil-gui control panel. Mutates `config` in place; the simulation reads from
 * the same object every frame, so changes are live.
 */

import GUI from 'lil-gui';
import type { Config } from '../config.ts';

export interface GuiCallbacks {
  onBoidCountChange: (count: number) => void;
  onReset: () => void;
}

export function buildGui(config: Config, callbacks: GuiCallbacks): GUI {
  const gui = new GUI({ title: 'Murmuration' });

  const fPop = gui.addFolder('Population');
  fPop
    .add(config, 'boidCount', 10, 1500, 10)
    .onChange((n: number) => callbacks.onBoidCountChange(n));
  fPop.add({ reset: callbacks.onReset }, 'reset').name('Reset positions');

  const fPerception = gui.addFolder('Perception');
  fPerception.add(config, 'perceptionRadius', 10, 200, 1);
  fPerception.add(config, 'separationRadius', 5, 100, 1);

  const fMotion = gui.addFolder('Motion');
  fMotion.add(config, 'maxSpeed', 20, 500, 1);
  fMotion.add(config, 'minSpeed', 0, 500, 1);
  fMotion.add(config, 'maxForce', 10, 1000, 1);

  const fRules = gui.addFolder('Rules');
  fRules.add(config, 'enableSeparation').name('Separation on');
  fRules.add(config, 'separationWeight', 0, 5, 0.05);
  fRules.add(config, 'enableAlignment').name('Alignment on');
  fRules.add(config, 'alignmentWeight', 0, 5, 0.05);
  fRules.add(config, 'enableCohesion').name('Cohesion on');
  fRules.add(config, 'cohesionWeight', 0, 5, 0.05);

  const fWalls = gui.addFolder('Walls');
  fWalls.add(config, 'wallWeight', 0, 5, 0.05);
  fWalls.add(config, 'wallMargin', 0, 400, 1);

  const fDebug = gui.addFolder('Debug');
  fDebug.add(config, 'trailMode').name('Motion trails');
  fDebug.add(config, 'colourByHeading').name('Colour by heading');
  fDebug.add(config, 'showPerceptionRadius').name('Show perception (boid 0)');
  fDebug.add(config, 'showVelocityVectors').name('Show velocities');
  fDebug.add(config, 'paused').name('Paused');

  return gui;
}
