import { describe, it, expect } from 'vitest';
import { getRules } from '../rules/registry';
import { YGameRules } from '../rules/YGameRules';
import { WhyNotGameRules } from '../rules/WhyNotGameRules';
import type { GameVariant } from '../types/game';

describe('getRules registry', () => {
  it('returns a YGameRules instance for variant "y"', () => {
    expect(getRules('y')).toBeInstanceOf(YGameRules);
  });

  it('returns a YGameRules instance when variant is undefined (defaults to "y")', () => {
    expect(getRules(undefined)).toBeInstanceOf(YGameRules);
  });

  it('the returned instance has variant "y"', () => {
    expect(getRules('y').variant).toBe('y');
  });

  it('returns a WhyNotGameRules instance for variant "why-not"', () => {
    expect(getRules('why-not')).toBeInstanceOf(WhyNotGameRules);
  });

  it('the returned why-not instance has variant "why-not"', () => {
    expect(getRules('why-not').variant).toBe('why-not');
  });

  it('throws with status 400 for an unknown variant string', () => {
    expect(() => getRules('unknown' as GameVariant)).toThrow();
    try {
      getRules('unknown' as GameVariant);
    } catch (err) {
      expect((err as { status: number }).status).toBe(400);
    }
  });

  it('always returns the same instance (singleton per variant)', () => {
    expect(getRules('y')).toBe(getRules('y'));
    expect(getRules('why-not')).toBe(getRules('why-not'));
  });
});
