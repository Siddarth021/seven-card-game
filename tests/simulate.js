// tests/simulate.js
// Runs complete bot-vs-bot games end-to-end through the real engine to
// smoke-test integration paths that unit tests don't reach (draw-pile
// exhaustion over many turns, rotation across several rounds, repeated
// eliminations, etc). Run with: node tests/simulate.js

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

const SAFETY_CAP = 20000;

function makePlayers(count) {
  return Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `Bot ${i + 1}`, isBot: true }));
}

function stepOnce(state) {
  const player = state.players[state.currentPlayerIndex];
  const action = decideBotAction(state, player);
  let result;
  if (action.type === 'SHOW') result = callShow(state, player.id);
  else if (action.type === 'PLAY') result = playGroup(state, player.id, action.cardIds);
  else result = exchange(state, player.id, action.cardIds);

  if (result.error) {
    // Should never happen -- the bot must only propose legal moves.
    throw new Error(`Bot proposed an illegal move: ${result.error}`);
  }
}

function runGame(mode, playerCount, options) {
  const state = createGame(makePlayers(playerCount), { mode, ...options });
  let steps = 0;

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

test('single-round games with 2-6 players terminate with a winner', () => {
  for (let count = 2; count <= 6; count++) {
    const { state } = runGame(MODE.SINGLE_ROUND, count, { wrongShowPenalty: 25 });
    if (!state.winnerId) throw new Error(`No winner declared for ${count}-player single round`);
  }
});

test('elimination games with 3-6 players terminate with exactly one survivor', () => {
  for (let count = 3; count <= 6; count++) {
    const { state } = runGame(MODE.ELIMINATION, count, { wrongShowPenalty: 20, eliminationThreshold: 80 });
    const survivors = state.players.filter((p) => p.active);
    if (survivors.length !== 1) throw new Error(`Expected exactly 1 survivor, got ${survivors.length}`);
    if (survivors[0].id !== state.winnerId) throw new Error('Winner mismatch with sole survivor');
  }
});

test('50 randomized elimination games all terminate without error', () => {
  for (let i = 0; i < 50; i++) {
    const count = 2 + (i % 5);
    const threshold = 40 + (i % 4) * 20;
    runGame(MODE.ELIMINATION, count, { wrongShowPenalty: 15 + (i % 3) * 10, eliminationThreshold: threshold });
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
console.log(`\n${passed} passed, ${failed} failed, ${tests.length} total.`);
if (failed > 0) process.exit(1);
