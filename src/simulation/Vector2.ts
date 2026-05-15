/**
 * Minimal 2D vector type and helpers.
 *
 * Design note: kept as a plain { x, y } object rather than a class. We allocate
 * a *lot* of these per frame (each rule produces several intermediate vectors
 * per boid per frame), and avoiding `new` keeps the GC quieter. Helpers below
 * are mostly non-mutating; the ones that mutate end in `Mut` and exist for the
 * inner-loop hot paths where allocation matters.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export const v = (x: number, y: number): Vec2 => ({ x, y });

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });

export const lengthSq = (a: Vec2): number => a.x * a.x + a.y * a.y;
export const length = (a: Vec2): number => Math.sqrt(lengthSq(a));

export const normalize = (a: Vec2): Vec2 => {
  const len = length(a);
  return len > 0 ? { x: a.x / len, y: a.y / len } : { x: 0, y: 0 };
};

/** Scale a vector to a target length. Returns zero vector if input is zero. */
export const setMagnitude = (a: Vec2, mag: number): Vec2 => {
  const len = length(a);
  return len > 0 ? { x: (a.x / len) * mag, y: (a.y / len) * mag } : { x: 0, y: 0 };
};

/** Clamp a vector's magnitude to `max`. Direction preserved. */
export const limit = (a: Vec2, max: number): Vec2 => {
  const lsq = lengthSq(a);
  if (lsq <= max * max) return a;
  const len = Math.sqrt(lsq);
  return { x: (a.x / len) * max, y: (a.y / len) * max };
};

// --- Mutating helpers for hot paths -----------------------------------------

export const addMut = (target: Vec2, b: Vec2): void => {
  target.x += b.x;
  target.y += b.y;
};

export const scaleMut = (target: Vec2, s: number): void => {
  target.x *= s;
  target.y *= s;
};
