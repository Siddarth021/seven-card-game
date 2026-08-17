// src/game/bot.js
// Bot decision-making. A bot only ever looks at its OWN hand, the Open
// Card, the Joker, and public information (turn counts, active player
// count) -- it never reads another player's hidden hand.

import { getCardValue, calculateHandTotal } from './joker.js';
import { isShowAvailable } from './engine.js';

function groupByRank(hand) {
  const groups = new Map();
  for (const c of hand) {
    if (!groups.has(c.rank)) groups.set(c.rank, []);
    groups.get(c.rank).push(c);
  }
  return groups;
}

/**
 * Decides the bot's action for its current turn.
 * Returns one of:
 *   { type: 'SHOW' }
 *   { type: 'PLAY', cardIds: [...] }
 *   { type: 'EXCHANGE', cardIds: [...] }
 */
export function decideBotAction(state, player) {
  const jokerCard = state.jokerCard;
  const myTotal = calculateHandTotal(player.hand, jokerCard);

  // Consider calling SHOW when it's available and our total looks safe.
  if (isShowAvailable(state)) {
    const active = state.players.filter((p) => p.active);
    const others = active.filter((p) => p.id !== player.id);
    // Bots don't see opponents' hands; they estimate risk from hand size
    // and their own total as a heuristic, then gamble accordingly.
    const avgOpponentHandSize = others.reduce((s, p) => s + p.hand.length, 0) / Math.max(1, others.length);
    const confident = myTotal <= 6 || (player.hand.length <= 2 && myTotal <= 12);
    const reasonableGamble = myTotal <= 10 && player.hand.length <= avgOpponentHandSize;
    if (confident || reasonableGamble) {
      return { type: 'SHOW' };
    }
  }

  const groups = groupByRank(player.hand);
  const openRankGroup = state.openCard ? groups.get(state.openCard.rank) : null;

  if (openRankGroup && openRankGroup.length > 0) {
    // Prefer shedding as many matching cards as possible to shrink the hand.
    return { type: 'PLAY', cardIds: openRankGroup.map((c) => c.id) };
  }

  // No match -- exchange. Prefer discarding the largest same-rank group
  // among our highest-value cards to reduce total value the most.
  let bestGroup = [player.hand[0]];
  let bestScore = -1;
  for (const [, cards] of groups) {
    const value = getCardValue(cards[0], jokerCard);
    const score = cards.length * 1000 + value; // prioritize group size, then value
    if (score > bestScore) {
      bestScore = score;
      bestGroup = cards;
    }
  }

  return { type: 'EXCHANGE', cardIds: bestGroup.map((c) => c.id) };
}
