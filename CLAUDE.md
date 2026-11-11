# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Browser boid-flocking simulation (starling murmuration). Vite + TypeScript + Canvas 2D, with lil-gui for the control panel. No framework, no backend.

## Commands

- `npm run dev` — Vite dev server (usually http://localhost:5173)
- `npm run build` — `tsc` type-check, then `vite build` into `dist/`
- `npm run preview` — serve the built `dist/`
- `npx tsc` — type-check only (`noEmit` is set)
- `npm test` — run all Vitest tests once; `npm run test:watch` for watch mode
- `npx vitest run src/simulation/Flock.test.ts` — run one test file
- `npx vitest run -t "resize shrinks"` — run tests whose name matches
- `npm run lint` — ESLint (flat config in `eslint.config.js`, typescript-eslint recommended)
- `npm run check` — `tsc && eslint . && vitest run`; run this before committing

Tests live next to the code as `src/**/*.test.ts` and run in a Node environment (no DOM), so only `simulation/` is tested. `rules.test.ts` holds a brute-force O(n²) reference scan and asserts the grid matches it exactly — keep that test when changing `SpatialGrid` or `gatherNeighbourStats`.

## Architecture

Three tiers in separate folders under `src/`. Keep them separate:

- `simulation/` — pure state and maths. No DOM, no canvas.
- `render/Renderer.ts` — read-only consumer of the `Flock`. Never mutates simulation state.
- `ui/` — lil-gui panel (`gui.ts`) and mouse wiring (`InputController.ts`).

`main.ts` wires everything: DPI-scaled canvas, `Flock`, `Renderer`, GUI callbacks, input, and the `requestAnimationFrame` loop. `dt` is in seconds and clamped to `1/30` so a backgrounded tab does not explode the sim.

### Config

`src/config.ts` exports one mutable `config` object. lil-gui writes to it directly. The simulation reads it live every frame (it is passed into `flock.step(dt, config)` and every rule function). Adding a tunable = add a field to `Config` + default in `config` + a control in `gui.ts`. Actions that need more than a value change (resize, reset, spawn predator) go through `GuiCallbacks`.

### Flock update pipeline (`simulation/Flock.ts`)

Per frame:
1. Predators update first (`Predator.ts`: target lock, chase steering, pack behaviour by `config.huntingStrategy` — `'solo'` or `'spreading'`).
2. Prey phase 1: compute all accelerations from the current snapshot — separation/alignment/cohesion (`rules.ts`), `flee` from predators (`flee.ts`), `pointerForce` (`Pointer.ts`), soft wall force.
3. Prey phase 2: integrate accel → velocity (clamped to `[minSpeed, maxSpeed]`) → position.
4. Kill check, if `removeOnKill` is on.

The update is **double-buffered**: phase 1 must not write positions/velocities, so every boid sees the same world snapshot. Preserve this when adding forces.

### Conventions

- **Reynolds steering everywhere**: `desired = normalise(target) * maxSpeed; steer = limit(desired - velocity, maxForce)`. New forces should follow this pattern, then be weighted.
- **Allocation-avoidance**: neighbour stats use one reusable scratch object on `Flock` (`statsScratch`), refilled per boid. Do not allocate per-boid objects in the hot loop.
- **Neighbour search uses a uniform spatial grid** (`SpatialGrid.ts`). `Flock.step` rebuilds it each frame with cell size = `perceptionRadius`, then `rules.ts::gatherNeighbourStats` scans the 3×3 cells around a boid. If you add a force with a query radius larger than `perceptionRadius`, either grow the cell size or scan more cells — otherwise neighbours will be missed silently.
- `Pointer` is a plain object shared by reference: `InputController` writes it, `Flock` reads it. Left mouse = attract, right = repel. Input inside the GUI panel is ignored.
- Imports use explicit `.ts` extensions and `import type` (`verbatimModuleSyntax` is on).

## Docs

- `README.md` — parameter table, tuning tips, roadmap.
- `docs/gauntlet-3d.md` — a planning prompt for a future Three.js 3D port. Not implemented yet.
