import { describe, expect, it } from 'vitest';
import { add, length, limit, normalize, scale, setMagnitude, sub, v } from './Vector2.ts';

describe('Vector2', () => {
  it('adds, subtracts and scales', () => {
    expect(add(v(1, 2), v(3, 4))).toEqual({ x: 4, y: 6 });
    expect(sub(v(3, 4), v(1, 2))).toEqual({ x: 2, y: 2 });
    expect(scale(v(1, -2), 3)).toEqual({ x: 3, y: -6 });
  });

  it('computes length', () => {
    expect(length(v(3, 4))).toBe(5);
    expect(length(v(0, 0))).toBe(0);
  });

  it('normalize returns a unit vector, or zero for zero input', () => {
    expect(normalize(v(0, 5))).toEqual({ x: 0, y: 1 });
    expect(normalize(v(0, 0))).toEqual({ x: 0, y: 0 });
  });

  it('setMagnitude keeps direction and sets length', () => {
    const out = setMagnitude(v(3, 4), 10);
    expect(out.x).toBeCloseTo(6);
    expect(out.y).toBeCloseTo(8);
    expect(setMagnitude(v(0, 0), 10)).toEqual({ x: 0, y: 0 });
  });

  it('limit clamps only when over max', () => {
    const small = v(1, 1);
    expect(limit(small, 5)).toBe(small); // same object when under the cap
    const big = limit(v(30, 40), 5);
    expect(length(big)).toBeCloseTo(5);
    expect(big.x / big.y).toBeCloseTo(0.75); // direction preserved
  });
});
