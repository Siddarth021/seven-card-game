import assert from 'node:assert/strict';
import { createDeck, shuffleDeck } from '../src/game/cards.js';
import { getCardValue, calculateHandTotal } from '../src/game/joker.js';
import { canMatch, canPlayGroup, canExchange } from '../src/game/rules.js';
import {
  createGame,
  playGroup,
  exchange,
  callShow,
  finalizeRound,
  continueToNextRound,
  isShowAvailable,
  PHASE,
  MODE,
} from '../src/game/engine.js';

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function card(rank, suit) {
  const deck = createDeck();
  return deck.find((c) => c.rank === rank && c.suit === suit);
}

// ----------------------------------------------------
// PHASE 2 - GAME ENGINE UNIT TESTS EXPANSION
// ----------------------------------------------------

// DECK
test('QA: deck has correct ranks and suits', () => {
  const deck = createDeck();
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const suits = ['hearts','diamonds','clubs','spades'];
  for (const suit of suits) {
    for (const rank of ranks) {
      assert.ok(deck.find(c => c.rank === rank && c.suit === suit), `Missing ${rank} of ${suit}`);
    }
  }
});

// HAND
test('QA: Discard multiple legal matching cards', () => {
  const state = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], { mode: MODE.SINGLE_ROUND, wrongShowPenalty: 25 });
  const p = state.players[0];
  state.currentPlayerIndex = 0;
  state.openCard = card('7', 'hearts');
  p.hand = [card('7', 'spades'), card('7', 'diamonds'), card('7', 'clubs'), card('A', 'hearts'), card('2', 'clubs')];
  
  const before = p.hand.length; // 5
  const result = playGroup(state, 'a', [card('7', 'spades').id, card('7', 'diamonds').id, card('7', 'clubs').id]);
  assert.equal(result.error, null);
  assert.equal(p.hand.length, before - 3); // 2
  assert.equal(state.openCard.rank, '7');
});

test('QA: Invalid mixed-rank discard group fails', () => {
  const state = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], { mode: MODE.SINGLE_ROUND, wrongShowPenalty: 25 });
  state.currentPlayerIndex = 0;
  state.openCard = card('7', 'hearts');
  state.players[0].hand = [card('7', 'spades'), card('8', 'diamonds')];
  
  const result = playGroup(state, 'a', [card('7', 'spades').id, card('8', 'diamonds').id]);
  assert.notEqual(result.error, null);
});

test('QA: No match exchange allows any card', () => {
  const state = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], { mode: MODE.SINGLE_ROUND, wrongShowPenalty: 25 });
  state.currentPlayerIndex = 0;
  state.openCard = card('8', 'hearts');
  state.players[0].hand = [card('K', 'spades'), card('7', 'diamonds')];
  
  const result = exchange(state, 'a', [card('K', 'spades').id]);
  assert.equal(result.error, null);
  assert.equal(state.openCard.rank, 'K');
  assert.equal(state.openCard.suit, 'spades');
});

// JOKER
test('QA: Joker matching exhaustively', () => {
  // If Joker is 7-hearts (red)
  const joker = card('7', 'hearts');
  assert.equal(getCardValue(card('7', 'hearts'), joker), 0);
  assert.equal(getCardValue(card('7', 'diamonds'), joker), 0);
  assert.equal(getCardValue(card('7', 'clubs'), joker), 7);
  assert.equal(getCardValue(card('7', 'spades'), joker), 7);

  // If Joker is Q-clubs (black)
  const joker2 = card('Q', 'clubs');
  assert.equal(getCardValue(card('Q', 'clubs'), joker2), 0);
  assert.equal(getCardValue(card('Q', 'spades'), joker2), 0);
  assert.equal(getCardValue(card('Q', 'hearts'), joker2), 10);
  assert.equal(getCardValue(card('Q', 'diamonds'), joker2), 10);
});

// EMPTY DECK
test('QA: Empty draw deck recycles correctly, excludes current Open Card', () => {
  const state = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], { mode: MODE.SINGLE_ROUND, wrongShowPenalty: 25 });
  state.currentPlayerIndex = 0;
  state.openCard = card('A', 'spades');
  state.discardPile = [card('2', 'hearts'), card('3', 'clubs')];
  state.drawPile = []; // Empty draw pile
  state.players[0].hand = [card('K', 'diamonds')];
  
  const result = exchange(state, 'a', [card('K', 'diamonds').id]);
  assert.equal(result.error, null);
  assert.ok(state.drawPile.length > 0);
  assert.equal(state.openCard.rank, 'K'); // K is new open card
  // The recycled deck should contain the old open card, but NOT the new one (K diamonds)
  const oldOpenInDrawOrHand = state.drawPile.some(c => c.rank === 'A' && c.suit === 'spades') || state.players[0].hand.some(c => c.rank === 'A' && c.suit === 'spades');
  assert.ok(oldOpenInDrawOrHand);
  const newOpenInDraw = state.drawPile.some(c => c.rank === 'K' && c.suit === 'diamonds');
  assert.equal(newOpenInDraw, false);
});

// ----------------------------------------------------
// PHASE 3 - SHOW TESTING
// ----------------------------------------------------

test('QA: Tied lowest total SHOW is wrong for caller', () => {
  const state = createGame(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
    { mode: MODE.SINGLE_ROUND, wrongShowPenalty: 35 }
  );
  state.jokerCard = card('A', 'hearts');
  state.players[0].hand = [card('9', 'clubs')]; // 9
  state.players[1].hand = [card('9', 'diamonds')]; // 9 (TIE)
  state.players[2].hand = [card('10', 'hearts')]; // 10
  
  for (const p of state.players) p.turnsCompleted = 3;
  state.currentPlayerIndex = 0;
  
  const result = callShow(state, 'a');
  assert.equal(result.error, null);
  assert.equal(state.lastShowResult.correct, false);
  assert.equal(state.roundScores.a, 35); // Caller gets penalty
  assert.equal(state.roundScores.b, 0);  // Tied player gets 0
  assert.equal(state.roundScores.c, 10); // Other player gets total
});

test('QA: Multi-player ties (3-way tie)', () => {
  const state = createGame(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
    { mode: MODE.SINGLE_ROUND, wrongShowPenalty: 35 }
  );
  state.jokerCard = card('A', 'hearts');
  state.players[0].hand = [card('5', 'clubs')]; // 5
  state.players[1].hand = [card('5', 'diamonds')]; // 5
  state.players[2].hand = [card('5', 'hearts')]; // 5
  for (const p of state.players) p.turnsCompleted = 3;
  state.currentPlayerIndex = 0;
  
  const result = callShow(state, 'a');
  assert.equal(state.lastShowResult.correct, false);
  assert.equal(state.roundScores.a, 35);
});

test('QA: SHOW before allowed turn count is rejected', () => {
  const state = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], { mode: MODE.SINGLE_ROUND, wrongShowPenalty: 25 });
  state.players[0].turnsCompleted = 2; // Not enough
  state.currentPlayerIndex = 0;
  
  const result = callShow(state, 'a');
  assert.notEqual(result.error, null);
});


// Run all QA unit tests
let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    t.fn();
    passed++;
    console.log(`  ✓ ${t.name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${t.name}`);
    console.error(err);
  }
}
console.log(`\n${passed} passed, ${failed} failed, ${tests.length} total QA tests.`);
if (failed > 0) process.exit(1);
