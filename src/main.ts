/**
 * Entry point. Wires up canvas, simulation, renderer, GUI, and the render loop.
 */

import './style.css';
import { config } from './config.ts';
import { Flock } from './simulation/Flock.ts';
import { Renderer } from './render/Renderer.ts';
import { buildGui } from './ui/gui.ts';

// --- Canvas setup with DPI scaling ------------------------------------------

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const statsEl = document.getElementById('stats')!;

function resizeCanvas(): void {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = window.innerWidth;
  const cssHeight = window.innerHeight;

  // Backing-store size (real pixels)
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);
  // Display size (CSS pixels)
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  // Scale the 2D context so we can keep working in CSS pixels everywhere else.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  flock?.setWorldSize(cssWidth, cssHeight);
}

// --- Build simulation -------------------------------------------------------

let flock: Flock = new Flock(window.innerWidth, window.innerHeight);
const initialSpeed = (config.maxSpeed + config.minSpeed) / 2;
flock.populate(config.boidCount, initialSpeed);

const renderer = new Renderer(
  ctx,
  () => window.innerWidth,
  () => window.innerHeight,
);

buildGui(config, {
  onBoidCountChange: (n) => flock.resize(n, (config.maxSpeed + config.minSpeed) / 2),
  onReset: () => flock.populate(config.boidCount, (config.maxSpeed + config.minSpeed) / 2),
});

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
  // Clamp dt: if the tab was backgrounded, rawDt can be huge and the sim
  // explodes. 1/30s ceiling keeps things sane after focus returns.
  const dt = Math.min(rawDt, 1 / 30);

  if (!config.paused) {
    flock.step(dt, config);
  }
  renderer.draw(flock, config);

  // FPS readout, averaged over ~0.5s windows
  fpsAccum += rawDt;
  fpsFrames++;
  if (fpsAccum >= 0.5) {
    fpsDisplay = fpsFrames / fpsAccum;
    fpsAccum = 0;
    fpsFrames = 0;
  }
  statsEl.textContent = `${fpsDisplay.toFixed(0)} fps  ·  ${flock.boids.length} boids`;

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
