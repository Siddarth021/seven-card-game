import {
  createGame,
  playGroup,
  exchange,
  callShow,
  finalizeRound,
  continueToNextRound,
  PHASE,
  MODE,
} from '../src/game/engine.js';
import { decideBotAction } from '../src/game/bot.js';
import assert from 'node:assert/strict';

const SAFETY_CAP = 20000;

function makePlayers(count) {
  return Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `Bot ${i + 1}`, isBot: true }));
}

function checkInvariants(state) {
  // 1. Total cards must remain 52
  let totalCards = state.drawPile.length + state.discardPile.length;
  if (state.openCard) totalCards += 1;
  if (state.jokerCard) totalCards += 1;
  for (const p of state.players) {
    if (p.active) {
      totalCards += p.hand.length;
    }
  }
  
  if (totalCards !== 52) {
    throw new Error(`Invariant failed: Total cards is ${totalCards}, expected 52.`);
  }

  // 2. Open Card must match the last discarded card if discard pile exists? 
  // No, the discarded cards don't necessarily match the open card. Open Card is the last dropped card.

  // 3. No player has impossible number of cards
  for (const p of state.players) {
    if (p.hand.length < 0 || p.hand.length > 7) { // Can technically have more than 7? No, discard happens first. Wait, what if someone draws but doesn't discard? Engine prevents it. Max is 7. Wait, if someone has 7 and discards 1 and draws 1, they have 7. If they have 5 and draw 1 they have 5. Hand size <= 7.
      throw new Error(`Invariant failed: Player ${p.id} has ${p.hand.length} cards.`);
    }
  }

  // 4. Eliminated player cannot take turns
  if (state.gamePhase === PHASE.PLAYING) {
    const p = state.players[state.currentPlayerIndex];
    if (!p.active) {
      throw new Error(`Invariant failed: Eliminated player ${p.id} is taking a turn.`);
    }
  }
}

function stepOnce(state) {
  const player = state.players[state.currentPlayerIndex];
  const action = decideBotAction(state, player);
  let result;
  if (action.type === 'SHOW') result = callShow(state, player.id);
  else if (action.type === 'PLAY') result = playGroup(state, player.id, action.cardIds);
  else result = exchange(state, player.id, action.cardIds);

  if (result.error) {
    throw new Error(`Bot proposed an illegal move: ${result.error}`);
  }
  
  checkInvariants(state);
}

function runGame(mode, playerCount, options, seed) {
  // deterministic seed not natively supported by JS Math.random unless we mock it, 
  // but we will just rely on standard randomness and catch failures.
  const state = createGame(makePlayers(playerCount), { mode, ...options });
  let steps = 0;

  checkInvariants(state);

  while (state.gamePhase !== PHASE.GAME_OVER) {
    steps++;
    if (steps > SAFETY_CAP) {
      throw new Error(`Game did not terminate within ${SAFETY_CAP} steps (mode=${mode}, players=${playerCount})`);
    }

    if (state.gamePhase === PHASE.PLAYING) {
      stepOnce(state);
    } else if (state.gamePhase === PHASE.SHOW_RESULT) {
      finalizeRound(state);
    } else if (state.gamePhase === PHASE.ROUND_RESULT || state.gamePhase === PHASE.ELIMINATION_RESULT) {
      continueToNextRound(state);
    } else {
      throw new Error(`Unexpected phase: ${state.gamePhase}`);
    }
  }

  return { state, steps };
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test('QA: 100 randomized games with invariant checking', () => {
  for (let i = 0; i < 100; i++) {
    const count = 2 + (i % 5);
    const mode = i % 2 === 0 ? MODE.SINGLE_ROUND : MODE.ELIMINATION;
    const threshold = 40 + (i % 4) * 20;
    runGame(mode, count, { wrongShowPenalty: 15 + (i % 3) * 10, eliminationThreshold: threshold }, i);
  }
});

test('QA: 1000 randomized games stress simulation', () => {
  for (let i = 0; i < 1000; i++) {
    const count = 2 + (i % 5);
    const mode = i % 2 === 0 ? MODE.SINGLE_ROUND : MODE.ELIMINATION;
    const threshold = 40 + (i % 4) * 20;
    runGame(mode, count, { wrongShowPenalty: 25, eliminationThreshold: threshold }, i);
  }
});

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
console.log(`\n${passed} passed, ${failed} failed, ${tests.length} total QA simulation tests.`);
if (failed > 0) process.exit(1);
