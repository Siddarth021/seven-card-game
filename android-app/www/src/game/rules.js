// src/game/rules.js
// Pure validation functions. No state mutation happens here.

/**
 * canMatch(card, openCard) -> boolean
 * Suit/color never matter. Only rank equality matters.
 */
export function canMatch(card, openCard) {
  if (!openCard) return false;
  return card.rank === openCard.rank;
}

/**
 * canPlayGroup(cards, openCard) -> boolean
 * A valid matching group:
 *  1. Has at least one card.
 *  2. Every card shares the same rank.
 *  3. That rank equals the Open Card's rank.
 */
export function canPlayGroup(cards, openCard) {
  if (!cards || cards.length === 0) return false;
  if (!openCard) return false;
  const rank = cards[0].rank;
  const sameRank = cards.every((c) => c.rank === rank);
  return sameRank && rank === openCard.rank;
}

/**
 * canExchange(cards) -> boolean
 * Any non-empty set of cards sharing exactly one rank is a legal
 * discard-and-draw exchange, regardless of the Open Card.
 */
export function canExchange(cards) {
  if (!cards || cards.length === 0) return false;
  const rank = cards[0].rank;
  return cards.every((c) => c.rank === rank);
}
