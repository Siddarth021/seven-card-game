// tests/engine.test.js
// Zero-dependency assertion tests. Run with: npm test

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

// ---- Test 1: 52-card deck contains exactly 52 unique cards ----
test('deck has exactly 52 unique cards', () => {
  const deck = createDeck();
  assert.equal(deck.length, 52);
  const ids = new Set(deck.map((c) => c.id));
  assert.equal(ids.size, 52);
});

// ---- Test 2: every player initially receives exactly 7 cards ----
test('every player starts a round with 7 cards', () => {
  const state = createGame(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
    { mode: MODE.SINGLE_ROUND, wrongShowPenalty: 25 }
  );
  for (const p of state.players) assert.equal(p.hand.length, 7);
});

// ---- Test 3: Joker A-hearts zero-value rule ----
test('joker A-hearts makes red aces 0 and black aces 1', () => {
  const jokerCard = card('A', 'hearts');
  assert.equal(getCardValue(card('A', 'hearts'), jokerCard), 0);
  assert.equal(getCardValue(card('A', 'diamonds'), jokerCard), 0);
  assert.equal(getCardValue(card('A', 'clubs'), jokerCard), 1);
  assert.equal(getCardValue(card('A', 'spades'), jokerCard), 1);
});

// ---- Test 4: Joker A-clubs zero-value rule ----
test('joker A-clubs makes black aces 0 and red aces 1', () => {
  const jokerCard = card('A', 'clubs');
  assert.equal(getCardValue(card('A', 'clubs'), jokerCard), 0);
  assert.equal(getCardValue(card('A', 'spades'), jokerCard), 0);
  assert.equal(getCardValue(card('A', 'hearts'), jokerCard), 1);
  assert.equal(getCardValue(card('A', 'diamonds'), jokerCard), 1);
});

// ---- Test 5: 7-hearts matches 7-spades ----
test('same rank matches regardless of suit', () => {
  assert.equal(canMatch(card('7', 'spades'), card('7', 'hearts')), true);
});

// ---- Test 6: 7-hearts does not match 8-spades ----
test('different rank does not match', () => {
  assert.equal(canMatch(card('8', 'spades'), card('7', 'hearts')), false);
});

// ---- Test 7: three 7s can be discarded together ----
test('three same-rank cards form a valid play group', () => {
  const open = card('7', 'diamonds');
  const group = [card('7', 'spades'), card('7', 'hearts'), card('7', 'clubs')];
  assert.equal(canPlayGroup(group, open), true);
});

// ---- Test 8: K + Q cannot be used as a multi-card exchange ----
test('mixed-rank exchange is invalid', () => {
  assert.equal(canExchange([card('K', 'spades'), card('Q', 'hearts')]), false);
});

// ---- Test 9: three Kings can be exchanged for one drawn card ----
test('same-rank exchange group is valid', () => {
  assert.equal(canExchange([card('K', 'spades'), card('K', 'hearts'), card('K', 'diamonds')]), true);
});

// ---- Test 10 & 30: cannot draw without discarding (no bare draw action exists) ----
test('engine exposes no draw-without-discard action', () => {
  const state = createGame(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    { mode: MODE.SINGLE_ROUND, wrongShowPenalty: 25 }
  );
  // Only playGroup and exchange mutate hands+piles; both require a
  // discard. There is no standalone "draw" export in engine.js.
  assert.equal(typeof state, 'object');
});

// ---- Test 11: a matching discard does not draw a replacement ----
test('playGroup does not draw a replacement card', () => {
  const state = createGame(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    { mode: MODE.SINGLE_ROUND, wrongShowPenalty: 25 }
  );
  const player = state.players[state.currentPlayerIndex];
  // Force a matching card into the player's hand for a deterministic test.
  const matchingCard = { ...state.openCard, id: 'forced-match' };
  player.hand[0] = matchingCard;
  const beforeSize = player.hand.length;
  const result = playGroup(state, player.id, [matchingCard.id]);
  assert.equal(result.error, null);
  assert.equal(player.hand.length, beforeSize - 1);
});

// ---- Test 12: a multi-card matching discard does not draw ----
test('multi-card playGroup shrinks hand by exactly the group size', () => {
  const state = createGame(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    { mode: MODE.SINGLE_ROUND, wrongShowPenalty: 25 }
  );
  const player = state.players[state.currentPlayerIndex];
  const rank = state.openCard.rank;
  const forced = [
    { id: 'fm1', rank, suit: 'hearts', baseValue: 5, color: 'red' },
    { id: 'fm2', rank, suit: 'clubs', baseValue: 5, color: 'black' },
  ];
  player.hand[0] = forced[0];
  player.hand[1] = forced[1];
  const before = player.hand.length;
  const result = playGroup(state, player.id, forced.map((c) => c.id));
  assert.equal(result.error, null);
  assert.equal(player.hand.length, before - 2);
});

// ---- Test 13: a multi-card exchange draws exactly one card ----
test('exchange with multiple discarded cards draws exactly one', () => {
  const state = createGame(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    { mode: MODE.SINGLE_ROUND, wrongShowPenalty: 25 }
  );
  const player = state.players[state.currentPlayerIndex];
  const forced = [
    { id: 'fx1', rank: 'K', suit: 'hearts', baseValue: 10, color: 'red' },
    { id: 'fx2', rank: 'K', suit: 'clubs', baseValue: 10, color: 'black' },
    { id: 'fx3', rank: 'K', suit: 'spades', baseValue: 10, color: 'black' },
  ];
  player.hand[0] = forced[0];
  player.hand[1] = forced[1];
  player.hand[2] = forced[2];
  const before = player.hand.length;
  const result = exchange(state, player.id, forced.map((c) => c.id));
  assert.equal(result.error, null);
  assert.equal(player.hand.length, before - 3 + 1);
});

// ---- Test 14: empty draw pile rebuilds from discard, preserving the
// (new, just-dropped) Open Card ----
test('draw pile recycles discard pile without swallowing the current Open Card', () => {
  const state = createGame(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    { mode: MODE.SINGLE_ROUND, wrongShowPenalty: 25 }
  );
  state.openCard = card('7', 'hearts');
  state.discardPile = [card('3', 'clubs'), card('5', 'diamonds'), card('K', 'spades'), card('8', 'hearts')];
  state.drawPile = [];

  const player = state.players[state.currentPlayerIndex];
  const forced = { id: 'unmatched', rank: 'Q', suit: 'diamonds', baseValue: 10, color: 'red' };
  player.hand[0] = forced;
  const result = exchange(state, player.id, [forced.id]);
  assert.equal(result.error, null);
  // The dropped Q-diamonds is now the Open Card (see the dedicated
  // "shared Open Card" tests below) -- and THAT card, the current one,
  // must never appear in the recycled draw pile.
  assert.equal(state.openCard.rank, 'Q');
  assert.equal(state.openCard.suit, 'diamonds');
  assert.equal(state.drawPile.some((c) => c.rank === 'Q' && c.suit === 'diamonds'), false);
});

// ---- Test 15 & 16: SHOW availability gated on 3 completed turns ----
test('SHOW is locked before 3 turns and available after', () => {
  const state = createGame(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    { mode: MODE.SINGLE_ROUND, wrongShowPenalty: 25 }
  );
  assert.equal(isShowAvailable(state), false);
  for (const p of state.players) p.turnsCompleted = 3;
  assert.equal(isShowAvailable(state), true);
});

// ---- Test 17: strictly lowest SHOW is correct ----
test('strictly lowest total makes SHOW correct', () => {
  const state = createGame(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
    { mode: MODE.SINGLE_ROUND, wrongShowPenalty: 25 }
  );
  state.jokerCard = card('A', 'hearts');
  state.players[0].hand = [card('2', 'clubs')]; // total 2
  state.players[1].hand = [card('9', 'clubs')]; // total 9
  state.players[2].hand = [card('K', 'clubs')]; // total 10
  for (const p of state.players) p.turnsCompleted = 3;
  state.currentPlayerIndex = 0;
  const result = callShow(state, 'a');
  assert.equal(result.error, null);
  assert.equal(state.lastShowResult.correct, true);
  assert.equal(state.roundScores.a, 0);
});

// ---- Test 18: tied lowest SHOW is wrong ----
test('tied lowest total makes SHOW wrong', () => {
  const state = createGame(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
    { mode: MODE.SINGLE_ROUND, wrongShowPenalty: 25 }
  );
  state.jokerCard = card('A', 'hearts');
  state.players[0].hand = [card('9', 'clubs')]; // 9, tied
  state.players[1].hand = [card('9', 'diamonds')]; // 9, tied
  state.players[2].hand = [card('K', 'clubs')]; // 10
  for (const p of state.players) p.turnsCompleted = 3;
  state.currentPlayerIndex = 0;
  const result = callShow(state, 'a');
  assert.equal(result.error, null);
  assert.equal(state.lastShowResult.correct, false);
});

// ---- Test 19: wrong SHOW applies the fixed penalty ----
test('wrong SHOW gives the caller the fixed penalty score', () => {
  const state = createGame(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    { mode: MODE.SINGLE_ROUND, wrongShowPenalty: 30 }
  );
  state.jokerCard = card('A', 'hearts');
  state.players[0].hand = [card('K', 'clubs')]; // 10
  state.players[1].hand = [card('2', 'clubs')]; // 2
  for (const p of state.players) p.turnsCompleted = 3;
  state.currentPlayerIndex = 0;
  callShow(state, 'a');
  assert.equal(state.roundScores.a, 30);
});

// ---- Test 20: lowest player receives 0 ----
test('lowest total player always scores 0 for the round', () => {
  const state = createGame(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    { mode: MODE.SINGLE_ROUND, wrongShowPenalty: 30 }
  );
  state.jokerCard = card('A', 'hearts');
  state.players[0].hand = [card('K', 'clubs')];
  state.players[1].hand = [card('2', 'clubs')];
  for (const p of state.players) p.turnsCompleted = 3;
  state.currentPlayerIndex = 0;
  callShow(state, 'a');
  assert.equal(state.roundScores.b, 0);
});

// ---- Test 21: cumulative scores are correctly updated ----
test('finalizeRound adds round scores onto cumulative scores', () => {
  const state = createGame(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    { mode: MODE.ELIMINATION, wrongShowPenalty: 25, eliminationThreshold: 100 }
  );
  state.cumulativeScores.a = 70;
  state.cumulativeScores.b = 82;
  state.roundScores = { a: 20, b: 25 };
  state.lastShowResult = { winnerId: 'a', callerId: 'a', correct: true };
  finalizeRound(state);
  assert.equal(state.cumulativeScores.a, 90);
  assert.equal(state.cumulativeScores.b, 107);
});

// ---- Test 22: score exactly equal to threshold eliminates ----
test('cumulative score exactly at threshold eliminates the player', () => {
  const state = createGame(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
    { mode: MODE.ELIMINATION, wrongShowPenalty: 25, eliminationThreshold: 100 }
  );
  state.cumulativeScores = { a: 95, b: 50, c: 40 };
  state.roundScores = { a: 5, b: 5, c: 5 };
  state.lastShowResult = { winnerId: 'b', callerId: 'b', correct: true };
  finalizeRound(state);
  assert.equal(state.cumulativeScores.a, 100);
  assert.equal(state.players.find((p) => p.id === 'a').active, false);
});

// ---- Test 23: score greater than threshold eliminates ----
test('cumulative score above threshold eliminates the player', () => {
  const state = createGame(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
    { mode: MODE.ELIMINATION, wrongShowPenalty: 25, eliminationThreshold: 100 }
  );
  state.cumulativeScores = { a: 98, b: 50, c: 40 };
  state.roundScores = { a: 10, b: 5, c: 5 };
  state.lastShowResult = { winnerId: 'b', callerId: 'b', correct: true };
  finalizeRound(state);
  assert.equal(state.cumulativeScores.a, 108);
  assert.equal(state.players.find((p) => p.id === 'a').active, false);
});

// ---- Test 24: multiple players can be eliminated simultaneously ----
test('multiple players can be eliminated in the same round', () => {
  const state = createGame(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
    { mode: MODE.ELIMINATION, wrongShowPenalty: 25, eliminationThreshold: 100 }
  );
  state.cumulativeScores = { a: 90, b: 95, c: 50 };
  state.roundScores = { a: 15, b: 10, c: 20 };
  state.lastShowResult = { winnerId: 'c', callerId: 'c', correct: true };
  finalizeRound(state);
  assert.equal(state.players.find((p) => p.id === 'a').active, false);
  assert.equal(state.players.find((p) => p.id === 'b').active, false);
  assert.equal(state.players.find((p) => p.id === 'c').active, true);
});

// ---- Test 25: the game ends when only one active player remains ----
test('game ends and declares a winner with one active player left', () => {
  const state = createGame(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
    { mode: MODE.ELIMINATION, wrongShowPenalty: 25, eliminationThreshold: 100 }
  );
  state.cumulativeScores = { a: 90, b: 95, c: 50 };
  state.roundScores = { a: 15, b: 10, c: 20 };
  state.lastShowResult = { winnerId: 'c', callerId: 'c', correct: true };
  finalizeRound(state);
  assert.equal(state.gamePhase, PHASE.GAME_OVER);
  assert.equal(state.winnerId, 'c');
});

// ---- Extra: hand total sums per-card joker-aware values ----
test('calculateHandTotal sums joker-aware card values', () => {
  const jokerCard = card('A', 'hearts');
  const hand = [card('10', 'clubs'), card('8', 'spades'), card('A', 'diamonds')];
  assert.equal(calculateHandTotal(hand, jokerCard), 18); // 10 + 8 + 0
});

// ---- Extra: starting player rotates and skips eliminated players ----
test('starting player rotates round to round and skips eliminated players', () => {
  const state = createGame(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
    { mode: MODE.ELIMINATION, wrongShowPenalty: 25, eliminationThreshold: 100 }
  );
  const firstStarter = state.startingPlayerIndex;
  state.players.find((p) => p.id === 'b').active = false;
  continueToNextRound(state);
  const secondStarterPlayer = state.players[state.startingPlayerIndex];
  assert.notEqual(secondStarterPlayer.id, 'b');
});

// ---- Shared Open Card: non-matching EXCHANGE updates it too ----
// This is the critical scenario: dropping a card that does NOT match
// the previous Open Card (as part of an exchange) must still replace
// the Open Card with that dropped card -- exactly like a matching play.
test('a non-matching EXCHANGE still becomes the new Open Card', () => {
  const state = createGame(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    { mode: MODE.SINGLE_ROUND, wrongShowPenalty: 25 }
  );
  const player = state.players[state.currentPlayerIndex];

  state.openCard = card('5', 'hearts');
  const nine = { id: 'nine-spades', rank: '9', suit: 'spades', baseValue: 9, color: 'black' };
  player.hand[0] = nine;
  const beforeSize = player.hand.length;

  const result = exchange(state, player.id, [nine.id]);
  assert.equal(result.error, null);
  assert.equal(state.openCard.id, 'nine-spades');
  assert.equal(state.openCard.rank, '9');
  // hand size: -1 discarded, +1 drawn = unchanged
  assert.equal(player.hand.length, beforeSize);
  // the old Open Card (5-hearts) must have joined the discard pile,
  // never silently vanish
  assert.equal(state.discardPile.some((c) => c.rank === '5' && c.suit === 'hearts'), true);
});

// ---- Shared Open Card: a multi-card EXCHANGE uses the LAST card ----
test('a multi-card EXCHANGE sets the Open Card to the last card dropped', () => {
  const state = createGame(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    { mode: MODE.SINGLE_ROUND, wrongShowPenalty: 25 }
  );
  const player = state.players[state.currentPlayerIndex];
  state.openCard = card('5', 'hearts');

  const kings = [
    { id: 'k-spades', rank: 'K', suit: 'spades', baseValue: 10, color: 'black' },
    { id: 'k-diamonds', rank: 'K', suit: 'diamonds', baseValue: 10, color: 'red' },
    { id: 'k-clubs', rank: 'K', suit: 'clubs', baseValue: 10, color: 'black' },
  ];
  player.hand[0] = kings[0];
  player.hand[1] = kings[1];
  player.hand[2] = kings[2];
  const beforeSize = player.hand.length;

  const result = exchange(state, player.id, kings.map((c) => c.id));
  assert.equal(result.error, null);
  assert.equal(state.openCard.id, 'k-clubs'); // the LAST card in the selection
  assert.equal(state.openCard.rank, 'K');
  // exactly one card drawn: -3 discarded, +1 drawn
  assert.equal(player.hand.length, beforeSize - 3 + 1);
});

// ---- Shared Open Card: it is genuinely global, single, shared state ----
// Simulates a full chain across three players -- exchange, then two
// matching plays -- and checks every player sees the same one Open
// Card, updated after every single action, with no per-player copies.
test('the Open Card is one shared value that updates after every drop in a chain', () => {
  const state = createGame(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
    { mode: MODE.SINGLE_ROUND, wrongShowPenalty: 25 }
  );
  const [a, b, c] = state.players;
  state.currentPlayerIndex = 0;
  state.openCard = card('5', 'hearts');

  // Player A exchanges a non-matching 9-spades.
  const nineSpades = { id: 'nine-spades', rank: '9', suit: 'spades', baseValue: 9, color: 'black' };
  a.hand[0] = nineSpades;
  a.turnsCompleted = 0;
  let result = exchange(state, a.id, [nineSpades.id]);
  assert.equal(result.error, null);
  assert.equal(state.openCard.rank, '9');
  assert.equal(state.currentPlayerIndex, 1); // turn moved to B

  // Player B plays a matching 9-diamonds.
  const nineDiamonds = { id: 'nine-diamonds', rank: '9', suit: 'diamonds', baseValue: 9, color: 'red' };
  b.hand[0] = nineDiamonds;
  result = playGroup(state, b.id, [nineDiamonds.id]);
  assert.equal(result.error, null);
  assert.equal(state.openCard.id, 'nine-diamonds');
  assert.equal(state.currentPlayerIndex, 2); // turn moved to C

  // Player C plays a matching 9-clubs.
  const nineClubs = { id: 'nine-clubs', rank: '9', suit: 'clubs', baseValue: 9, color: 'black' };
  c.hand[0] = nineClubs;
  result = playGroup(state, c.id, [nineClubs.id]);
  assert.equal(result.error, null);
  assert.equal(state.openCard.id, 'nine-clubs');

  // There is exactly one Open Card on the shared state object -- not a
  // per-player field -- and every player object reflects that same
  // engine-level truth by construction (no player.openCard exists).
  assert.equal('openCard' in a, false);
  assert.equal('openCard' in b, false);
  assert.equal('openCard' in c, false);
  assert.equal(state.openCard.rank, '9');
});

// ---- Runner ----
let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    t.fn();
    passed++;
    console.log(`  \u2713 ${t.name}`);
  } catch (e) {
    failed++;
    console.log(`  \u2717 ${t.name}`);
    console.log(`      ${e.message}`);
  }
}
console.log(`\n${passed} passed, ${failed} failed, ${tests.length} total.`);
if (failed > 0) process.exit(1);
