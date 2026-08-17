// src/game/joker.js
// The single authoritative source of truth for a card's real, in-round value.

/**
 * getCardValue(card, jokerCard)
 * Rule: if the Joker card is an Ace, then BOTH Aces sharing the Joker's
 * color become worth 0. All other cards keep their base value.
 */
export function getCardValue(card, jokerCard) {
  if (!jokerCard) return card.baseValue;

  if (card.rank === jokerCard.rank && card.color === jokerCard.color) {
    return 0;
  }

  return card.baseValue;
}

/**
 * calculateHandTotal(hand, jokerCard)
 * Sums getCardValue() for every card in the hand. Never duplicates the
 * per-card value logic anywhere else in the codebase.
 */
export function calculateHandTotal(hand, jokerCard) {
  return hand.reduce((sum, card) => sum + getCardValue(card, jokerCard), 0);
}

/**
 * Human readable description of the current joker effect, for UI display.
 */
export function jokerEffectDescription(jokerCard) {
  if (!jokerCard) return '';
  const colorLabel = jokerCard.color === 'red' ? 'Red' : 'Black';
  return `${colorLabel} ${jokerCard.rank}s = 0`;
}
