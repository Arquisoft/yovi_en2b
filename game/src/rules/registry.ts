import type { GameVariant } from '../types/game';
import type { GameRules } from './GameRules';
import { YGameRules } from './YGameRules';
import { WhyNotGameRules } from './WhyNotGameRules';

// Singleton instances — one per implemented variant.
type RulesMap = { [K in GameVariant]?: GameRules };

const RULES: RulesMap = {
  y: new YGameRules(),
  'why-not': new WhyNotGameRules(),
};

/**
 * Returns the GameRules instance for the requested variant.
 * Defaults to 'y' when variant is undefined (backwards compatibility).
 * Throws with HTTP 400 if the variant is unknown or not yet implemented.
 */
export function getRules(variant: GameVariant = 'y'): GameRules {
  const rules = RULES[variant];
  if (!rules) {
    throw Object.assign(
      new Error(`Game variant "${variant}" is not yet implemented`),
      { status: 400 },
    );
  }
  return rules;
}
