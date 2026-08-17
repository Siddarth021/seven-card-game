// src/game/engine.js
// Centralized, UI-agnostic game engine. The UI must never mutate hands,
// piles, or scores directly -- every change flows through here so the
// rules stay authoritative and consistent.

import { createDeck, shuffleDeck } from './cards.js';
import { getCardValue, calculateHandTotal } from './joker.js';
import { canMatch, canPlayGroup, canExchange } from './rules.js';

export const PHASE = {
  LOBBY: 'LOBBY',
  SETUP: 'SETUP',
  PLAYING: 'PLAYING',
  SHOW_RESULT: 'SHOW_RESULT',
  ROUND_RESULT: 'ROUND_RESULT',
  ELIMINATION_RESULT: 'ELIMINATION_RESULT',
  GAME_OVER: 'GAME_OVER',
};

export const MODE = {
  SINGLE_ROUND: 'SINGLE_ROUND',
  ELIMINATION: 'ELIMINATION',
};

const MIN_TURNS_BEFORE_SHOW = 3;
const STARTING_HAND_SIZE = 7;

function log(state, message) {
  state.eventLog.push(message);
  if (state.eventLog.length > 200) state.eventLog.shift();
}

/**
 * Creates a brand new game. Players: [{ id, name, isBot }]
 * options: { mode, wrongShowPenalty, eliminationThreshold }
 */
export function createGame(players, options) {
  const state = {
    gameMode: options.mode,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: !!p.isBot,
      hand: [],
      active: true,
      turnsCompleted: 0,
    })),
    deck: [],
    drawPile: [],
    discardPile: [],
    openCard: null,
    jokerCard: null,
    currentPlayerIndex: 0,
    // -1 so the rotation in startNewRound() lands on index 0 for the
    // very first round, then advances by one player each round after.
    startingPlayerIndex: -1,
    roundNumber: 0,
    wrongShowPenalty: options.wrongShowPenalty,
    eliminationThreshold: options.eliminationThreshold || null,
    gamePhase: PHASE.SETUP,
    deckCount: options.deckCount || 1,
    roundScores: {},
    cumulativeScores: {},
    lastShowResult: null,
    lastEliminated: [],
    winnerId: null,
    eventLog: [],
    pendingAction: null, // { type: 'PLAY' | 'EXCHANGE', requiresDrawAfter }
  };

  for (const p of state.players) {
    state.cumulativeScores[p.id] = 0;
  }

  startNewRound(state);
  return state;
}

function activePlayers(state) {
  return state.players.filter((p) => p.active);
}

function playerById(state, id) {
  return state.players.find((p) => p.id === id);
}

/**
 * Begins a fresh round: new deck, new joker, new hands, new piles.
 * Cumulative scores are preserved. Starting player rotates among
 * currently-active players.
 */
export function startNewRound(state) {
  state.roundNumber += 1;
  state.deck = shuffleDeck(createDeck(state.deckCount));
  state.roundScores = {};
  state.lastShowResult = null;
  state.lastEliminated = [];

  for (const p of activePlayers(state)) {
    p.hand = [];
    p.turnsCompleted = 0;
  }

  // 1. Select the Joker (any card from the shuffled deck).
  state.jokerCard = state.deck.pop();

  // 2. Deal 7 cards to every active player.
  for (let i = 0; i < STARTING_HAND_SIZE; i++) {
    for (const p of activePlayers(state)) {
      p.hand.push(state.deck.pop());
    }
  }

  // 3. Remaining cards become the draw deck.
  state.drawPile = state.deck;
  state.discardPile = [];

  // 4. Flip the initial Open Card.
  state.openCard = state.drawPile.pop();

  // 5. Determine the starting player, rotating between rounds and
  // skipping anyone no longer active.
  state.startingPlayerIndex = nextRotatedStartIndex(state);
  state.currentPlayerIndex = state.startingPlayerIndex;

  state.gamePhase = PHASE.PLAYING;
  state.pendingAction = null;

  log(state, `Round ${state.roundNumber} begins. Joker: ${state.jokerCard.rank}${state.jokerCard.suit[0].toUpperCase()}.`);
  const starter = state.players[state.currentPlayerIndex];
  log(state, `${starter.name} starts the round.`);
}

function nextRotatedStartIndex(state) {
  const n = state.players.length;
  let idx = (state.startingPlayerIndex + 1) % n;
  for (let i = 0; i < n; i++) {
    if (state.players[idx].active) return idx;
    idx = (idx + 1) % n;
  }
  return state.startingPlayerIndex;
}

function currentPlayer(state) {
  return state.players[state.currentPlayerIndex];
}

/**
 * Recycles the discard pile into a fresh draw pile when the draw pile is
 * empty. The current Open Card is NEVER included in the recycled pile.
 */
function ensureDrawPileHasCards(state) {
  if (state.drawPile.length > 0) return;
  if (state.discardPile.length === 0) return; // nothing to recycle, caller must handle
  state.drawPile = shuffleDeck(state.discardPile);
  state.discardPile = [];
  log(state, 'Draw pile was empty -- discard pile reshuffled into a new draw pile.');
}

function removeCardsFromHand(player, cards) {
  const ids = new Set(cards.map((c) => c.id));
  player.hand = player.hand.filter((c) => !ids.has(c.id));
}

/**
 * PLAY / DISCARD action: player discards 1+ same-rank cards that match
 * the Open Card's rank. No replacement card is drawn. Turn ends.
 */
export function playGroup(state, playerId, cardIds) {
  const player = playerById(state, playerId);
  const cards = player.hand.filter((c) => cardIds.includes(c.id));

  if (state.gamePhase !== PHASE.PLAYING) return err(state, 'The round is not currently active.');
  if (!player.active) return err(state, 'Eliminated players cannot act.');
  if (currentPlayer(state).id !== playerId) return err(state, 'It is not your turn.');
  if (cards.length !== cardIds.length) return err(state, 'Invalid card selection.');
  if (!canPlayGroup(cards, state.openCard)) {
    return err(state, 'These cards must all match the Open Card\u2019s rank.');
  }

  removeCardsFromHand(player, cards);
  // All but the last card go straight to the discard pile; the last
  // discarded card becomes the new Open Card, and the previous Open
  // Card joins the discard pile.
  state.discardPile.push(state.openCard);
  for (let i = 0; i < cards.length - 1; i++) state.discardPile.push(cards[i]);
  state.openCard = cards[cards.length - 1];

  log(state, `${player.name} discarded ${cards.length} card${cards.length > 1 ? 's' : ''} (${cards.map((c) => c.rank).join(', ')}).`);

  endTurn(state, player);
  return ok(state);
}

/**
 * EXCHANGE action: player discards 1+ same-rank cards (any rank) and
 * draws exactly one replacement card. Turn ends.
 *
 * The Open Card is GLOBAL, shared table state -- there is exactly one
 * of it, and it always reflects the single most recently dropped card,
 * regardless of whether that drop was a matching PLAY or a non-matching
 * EXCHANGE. So exactly like playGroup(), the old Open Card joins the
 * discard pile and the last card the player drops becomes the new Open
 * Card. The fact that the card didn't match the previous Open Card's
 * rank is irrelevant -- it still becomes the new Open Card the moment
 * it's dropped, and every subsequent player matches against it.
 */
export function exchange(state, playerId, cardIds) {
  const player = playerById(state, playerId);
  const cards = player.hand.filter((c) => cardIds.includes(c.id));

  if (state.gamePhase !== PHASE.PLAYING) return err(state, 'The round is not currently active.');
  if (!player.active) return err(state, 'Eliminated players cannot act.');
  if (currentPlayer(state).id !== playerId) return err(state, 'It is not your turn.');
  if (cards.length !== cardIds.length) return err(state, 'Invalid card selection.');
  if (!canExchange(cards)) return err(state, 'Exchanged cards must all share the same rank.');

  removeCardsFromHand(player, cards);

  // Same rule as a matching PLAY: the previous Open Card falls into the
  // discard pile, every dropped card but the last joins it too, and the
  // LAST card dropped becomes the new, single, shared Open Card.
  state.discardPile.push(state.openCard);
  for (let i = 0; i < cards.length - 1; i++) state.discardPile.push(cards[i]);
  state.openCard = cards[cards.length - 1];

  if (state.drawPile.length === 0) ensureDrawPileHasCards(state);

  if (state.drawPile.length > 0) {
    const drawn = state.drawPile.pop();
    player.hand.push(drawn);
    log(state, `${player.name} discarded ${cards.length} card${cards.length > 1 ? 's' : ''} (${cards.map((c) => c.rank).join(', ')}) and drew a replacement. Open Card is now ${state.openCard.rank}.`);
  } else {
    // Both piles exhausted (extreme edge case) -- exchange still counts,
    // player simply cannot draw this time.
    log(state, `${player.name} discarded ${cards.length} card${cards.length > 1 ? 's' : ''}, but no cards remained to draw. Open Card is now ${state.openCard.rank}.`);
  }

  endTurn(state, player);
  return ok(state);
}

function endTurn(state, player) {
  player.turnsCompleted += 1;

  if (player.hand.length === 0) {
    // Section 73: an empty hand is the strongest possible position.
    // Automatically trigger a round-ending SHOW on the player's behalf.
    log(state, `${player.name} has emptied their hand and automatically calls SHOW!`);
    resolveShow(state, player.id, true);
    return;
  }

  advanceTurnPointer(state);
}

function advanceTurnPointer(state) {
  const n = state.players.length;
  let idx = state.currentPlayerIndex;
  for (let i = 0; i < n; i++) {
    idx = (idx + 1) % n;
    if (state.players[idx].active) {
      state.currentPlayerIndex = idx;
      return;
    }
  }
}

/**
 * Whether SHOW is currently available: every active player must have
 * completed at least 3 turns this round.
 */
export function isShowAvailable(state) {
  return activePlayers(state).every((p) => p.turnsCompleted >= MIN_TURNS_BEFORE_SHOW);
}

export function callShow(state, playerId) {
  if (state.gamePhase !== PHASE.PLAYING) return err(state, 'The round is not currently active.');
  const player = playerById(state, playerId);
  if (!player.active) return err(state, 'Eliminated players cannot act.');
  if (currentPlayer(state).id !== playerId) return err(state, 'It is not your turn.');
  if (!isShowAvailable(state)) return err(state, 'SHOW is not available yet -- everyone needs at least 3 turns.');

  resolveShow(state, playerId, false);
  return ok(state);
}

/**
 * SHOW resolution algorithm (spec sections 36-41, 74-76).
 * autoTriggered: true when caused by a player reaching an empty hand.
 */
function resolveShow(state, callerId, autoTriggered) {
  const active = activePlayers(state);
  const totals = {};
  for (const p of active) totals[p.id] = calculateHandTotal(p.hand, state.jokerCard);

  const minimumTotal = Math.min(...active.map((p) => totals[p.id]));
  const minimumHolders = active.filter((p) => totals[p.id] === minimumTotal);
  const callerTotal = totals[callerId];
  const callerIsUniqueMinimum = minimumHolders.length === 1 && minimumHolders[0].id === callerId;

  const showCorrect = callerIsUniqueMinimum;

  const roundScores = {};
  for (const p of active) {
    if (totals[p.id] === minimumTotal) {
      roundScores[p.id] = 0;
    } else {
      roundScores[p.id] = totals[p.id];
    }
  }
  if (!showCorrect) {
    roundScores[callerId] = state.wrongShowPenalty;
  }

  state.roundScores = roundScores;
  state.lastShowResult = {
    callerId,
    callerName: playerById(state, callerId).name,
    correct: showCorrect,
    autoTriggered,
    totals,
    minimumTotal,
    winnerId: showCorrect ? callerId : minimumHolders[0].id,
    // Snapshot every active player's hand at the exact moment SHOW was
    // called. The result/reveal screens read from this snapshot -- never
    // from live player.hand -- so the revealed cards can never drift
    // from what actually decided the outcome, no matter what state
    // changes happen afterward (spec section 7).
    handsSnapshot: Object.fromEntries(active.map((p) => [p.id, p.hand.slice()])),
  };

  for (const p of active) {
    log(state, `${p.name}: ${totals[p.id]} points (${p.hand.length} card${p.hand.length === 1 ? '' : 's'}).`);
  }
  log(state, showCorrect
    ? `${playerById(state, callerId).name} called SHOW -- CORRECT!`
    : `${playerById(state, callerId).name} called SHOW -- WRONG! Penalty: ${state.wrongShowPenalty}.`);

  state.gamePhase = PHASE.SHOW_RESULT;
}

/**
 * Applies round scores to cumulative totals and, in Elimination Mode,
 * eliminates any player whose cumulative score has reached the
 * threshold. Call this after the player has viewed the SHOW result.
 */
export function finalizeRound(state) {
  const active = activePlayers(state);
  for (const p of active) {
    const roundScore = state.roundScores[p.id] || 0;
    state.cumulativeScores[p.id] = (state.cumulativeScores[p.id] || 0) + roundScore;
  }

  state.lastEliminated = [];

  if (state.gameMode === MODE.ELIMINATION) {
    for (const p of active) {
      if (state.cumulativeScores[p.id] >= state.eliminationThreshold) {
        p.active = false;
        state.lastEliminated.push(p.id);
        log(state, `${p.name} reached ${state.cumulativeScores[p.id]} points and is ELIMINATED.`);
      }
    }
  }

  const stillActive = activePlayers(state);

  if (state.gameMode === MODE.SINGLE_ROUND) {
    state.winnerId = state.lastShowResult.winnerId;
    state.gamePhase = PHASE.GAME_OVER;
    log(state, `${playerById(state, state.winnerId).name} wins the round!`);
    return state;
  }

  // Elimination mode.
  if (state.lastEliminated.length > 0) {
    state.gamePhase = PHASE.ELIMINATION_RESULT;
  } else {
    state.gamePhase = PHASE.ROUND_RESULT;
  }

  if (stillActive.length === 1) {
    state.winnerId = stillActive[0].id;
    state.gamePhase = PHASE.GAME_OVER;
    log(state, `${stillActive[0].name} is the last player standing -- WINNER!`);
  }

  return state;
}

/**
 * Advances from a round-result / elimination-result screen into the
 * next round. No-op if the game has already ended.
 */
export function continueToNextRound(state) {
  if (state.gamePhase === PHASE.GAME_OVER) return state;
  startNewRound(state);
  return state;
}

function ok(state) {
  return { state, error: null };
}

function err(state, message) {
  return { state, error: message };
}

export const engineInternals = { activePlayers, currentPlayer, canMatch, getCardValue };
