// src/game/cards.js
// Core card data model and deck utilities.

export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const SUIT_SYMBOL = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

const RED_SUITS = new Set(['hearts', 'diamonds']);

export function colorOfSuit(suit) {
  return RED_SUITS.has(suit) ? 'red' : 'black';
}

export function baseValueOfRank(rank) {
  if (rank === 'A') return 1;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return parseInt(rank, 10);
}

/**
 * Creates a fresh, ordered standard 52-card deck.
 * deckCount lets the table play with multiple decks shuffled together
 * (e.g. 2 decks = 104 cards, useful for bigger tables). Each physical
 * copy gets a distinct id suffix so duplicate cards (e.g. two A♥) never
 * collide in the engine, which only ever tracks cards by id.
 * Each card: { id, rank, suit, baseValue, color }
 */
export function createDeck(deckCount = 1) {
  const deck = [];
  for (let copy = 0; copy < deckCount; copy++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({
          id: deckCount > 1 ? `${rank}-${suit}-${copy}` : `${rank}-${suit}`,
          rank,
          suit,
          baseValue: baseValueOfRank(rank),
          color: colorOfSuit(suit),
        });
      }
    }
  }
  return deck;
}

/**
 * Fisher-Yates shuffle. Returns a new array, does not mutate input.
 */
export function shuffleDeck(deck) {
  const arr = deck.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function cardLabel(card) {
  return `${card.rank}${SUIT_SYMBOL[card.suit]}`;
}
