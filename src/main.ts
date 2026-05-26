/**
 * Entry point. Wires up canvas, simulation, renderer, GUI, input, and the render loop.
 */

import './style.css';
import { config } from './config.ts';
import { Flock } from './simulation/Flock.ts';
import { createPointer } from './simulation/Pointer.ts';
import { Renderer } from './render/Renderer.ts';
import { buildGui } from './ui/gui.ts';
import { InputController } from './ui/InputController.ts';

// --- Canvas setup with DPI scaling ------------------------------------------

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const statsEl = document.getElementById('stats')!;

function resizeCanvas(): void {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = window.innerWidth;
  const cssHeight = window.innerHeight;

  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  flock?.setWorldSize(cssWidth, cssHeight);
}

// --- Build simulation -------------------------------------------------------

const pointer = createPointer();

let flock: Flock = new Flock(window.innerWidth, window.innerHeight, pointer);
const initialPreySpeed = (config.maxSpeed + config.minSpeed) / 2;
flock.populate(config.boidCount, initialPreySpeed);

const renderer = new Renderer(
  ctx,
  () => window.innerWidth,
  () => window.innerHeight,
);

const gui = buildGui(config, {
  onBoidCountChange: (n) => flock.resize(n, (config.maxSpeed + config.minSpeed) / 2),
  onReset: () => flock.populate(config.boidCount, (config.maxSpeed + config.minSpeed) / 2),
  onSpawnPredator: () => flock.spawnPredator(config.predatorMaxSpeed * 0.8),
  onRemoveAllPredators: () => flock.removeAllPredators(),
});

// Hook up mouse → pointer. The InputController ignores events that originate
// inside the GUI panel, keeping UI and world cleanly separated.
new InputController(canvas, pointer, () => gui.domElement);

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// --- Main loop --------------------------------------------------------------

let lastTime = performance.now();
let fpsAccum = 0;
let fpsFrames = 0;
let fpsDisplay = 0;

function frame(now: number): void {
  const rawDt = (now - lastTime) / 1000;
  lastTime = now;
  const dt = Math.min(rawDt, 1 / 30);

  if (!config.paused) {
    flock.step(dt, config);
  }
  renderer.draw(flock, config);

  fpsAccum += rawDt;
  fpsFrames++;
  if (fpsAccum >= 0.5) {
    fpsDisplay = fpsFrames / fpsAccum;
    fpsAccum = 0;
    fpsFrames = 0;
  }
  const predText = flock.predators.length > 0
    ? `  ·  ${flock.predators.length} predator${flock.predators.length > 1 ? 's' : ''}`
    : '';
  statsEl.textContent = `${fpsDisplay.toFixed(0)} fps  ·  ${flock.boids.length} boids${predText}`;

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
