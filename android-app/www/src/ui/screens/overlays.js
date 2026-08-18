// src/ui/screens/overlays.js

import { h } from '../../utils/dom.js';
import { PHASE, MODE } from '../../game/engine.js';
import { getCardValue } from '../../game/joker.js';
import { renderCard } from '../components/card.js';

function overlay(children) {
  return h('div', { className: 'overlay' }, [h('div', { className: 'overlay-card' }, children)]);
}

export function renderOverlayForPhase(app) {
  const state = app.gameState;
  switch (state.gamePhase) {
    case PHASE.SHOW_RESULT:
      return renderShowResult(app, state);
    case PHASE.ROUND_RESULT:
      return renderRoundResult(app, state);
    case PHASE.ELIMINATION_RESULT:
      return renderEliminationResult(app, state);
    case PHASE.GAME_OVER:
      return renderGameOver(app, state);
    default:
      return null;
  }
}

function playersSortedByTotal(state) {
  const active = state.players.filter((p) => p.active || state.lastShowResult?.totals?.[p.id] != null);
  return active
    .filter((p) => state.lastShowResult.totals[p.id] != null)
    .slice()
    .sort((a, b) => state.lastShowResult.totals[a.id] - state.lastShowResult.totals[b.id]);
}

function renderShowResult(app, state) {
  const result = state.lastShowResult;
  const ordered = playersSortedByTotal(state);
  const winner = state.players.find((p) => p.id === result.winnerId);
  const caller = state.players.find((p) => p.id === result.callerId);
  const localHuman = app.getLocalHumanPlayer();

  const rows = ordered.map((p) => {
    const isWinnerRow = p.id === result.winnerId;
    return h('tr', { className: isWinnerRow ? 'is-winner' : '' }, [
      h('td', {}, [isWinnerRow ? '\ud83c\udfc6 ' : '', p.name + (p.id === result.callerId ? '  (SHOW)' : '')]),
      h('td', { className: 'num' }, String(p.hand.length)),
      h('td', { className: 'num' }, String(result.totals[p.id])),
      h('td', { className: 'num' }, String(state.roundScores[p.id] ?? 0)),
    ]);
  });

  const table = h('table', { className: 'results-table' }, [
    h('thead', {}, h('tr', {}, [h('th', {}, 'Player'), h('th', {}, 'Cards'), h('th', {}, 'Total'), h('th', {}, 'Round Score')])),
    h('tbody', {}, rows),
  ]);

  const hero = result.correct
    ? renderCorrectShowHero(app, result, winner, localHuman)
    : renderWrongShowHero(app, result, caller, winner, localHuman, state.wrongShowPenalty);

  const eliminationPreview = state.gameMode === MODE.ELIMINATION ? renderEliminationPreview(app, state) : null;

  return overlay([
    hero,
    h('h3', { className: 'drawer-title', style: 'margin-top: 22px;' }, 'Round Results'),
    table,
    eliminationPreview,
    h('div', { className: 'screen-actions' }, [
      h('button', { className: 'btn btn-secondary', onClick: () => app.openShowReveal() }, '\ud83d\udc41 View All Cards'),
      h('button', { className: 'btn btn-primary', onClick: () => app.continueAfterShow() }, 'Continue'),
    ]),
  ]);
}

/**
 * Winner hero panel for a CORRECT SHOW: trophy, big winner name, lowest
 * total, and "YOU WIN!" framing when the local human player is the one
 * who won. In shared-device / pass-and-play games with 2+ humans there
 * is no single "current user" to speak for, so framing falls back to
 * naming the winner instead of guessing who's holding the device.
 */
function renderCorrectShowHero(app, result, winner, localHuman) {
  let headline;
  if (localHuman) {
    headline = localHuman.id === winner.id ? '\ud83c\udf89 YOU WIN! \ud83c\udf89' : `\ud83c\udfc6 ${winner.name.toUpperCase()} WINS!`;
  } else {
    headline = `\ud83c\udfc6 ${winner.name.toUpperCase()} WINS!`;
  }
  const showLocalLoseNote = localHuman && localHuman.id !== winner.id;

  return h('div', { className: 'winner-hero winner-hero-celebrate' }, [
    h('div', { className: 'winner-confetti' }),
    h('div', { className: 'winner-trophy winner-trophy-bounce' }, '\ud83c\udfc6'),
    h('div', { className: 'result-tag correct', style: 'margin: 0 auto 6px;' }, 'SHOW WINNER \u2014 Correct SHOW'),
    h('div', { className: 'winner-name' }, winner.name),
    h('div', { className: 'winner-headline', style: 'margin-top: 14px;' }, headline),
    showLocalLoseNote ? h('div', { className: 'overlay-sub' }, 'You did not have the lowest total.') : null,
  ]);
}

/**
 * Winner hero panel for a WRONG SHOW: the caller's mistaken claim is
 * clearly separated from the player who actually won the round.
 */
function renderWrongShowHero(app, result, caller, winner, localHuman, wrongShowPenalty) {
  let headline;
  if (localHuman) {
    headline = localHuman.id === winner.id ? '\ud83c\udf89 YOU WIN THE ROUND!' : `${winner.name.toUpperCase()} WINS THE ROUND`;
  } else {
    headline = `${winner.name.toUpperCase()} WINS THE ROUND`;
  }
  const callerNote = localHuman && localHuman.id === caller.id;

  return h('div', { className: 'winner-hero winner-hero-wrong' }, [
    h('div', { className: 'winner-trophy' }, '\u2715'),
    h('div', { className: 'result-tag wrong', style: 'margin: 0 auto 6px;' }, 'WRONG SHOW'),
    h('div', { className: 'winner-name' }, `Called by ${caller.name}`),
    h('div', { className: 'winner-headline', style: 'margin-top: 14px;' }, headline),
    callerNote ? h('div', { className: 'overlay-sub is-error' }, `Your SHOW was wrong \u2014 penalty applied.`) : null,
  ]);
}

/**
 * Elimination-mode preview: projects each active player's cumulative
 * score after this round's scores are applied, so the group can see who
 * is about to cross the threshold before pressing Continue (which is
 * when the real elimination logic actually runs -- this panel only
 * previews it, per the existing threshold rules).
 */
function renderEliminationPreview(app, state) {
  const rows = playersSortedByTotal(state).map((p) => {
    const projected = (state.cumulativeScores[p.id] || 0) + (state.roundScores[p.id] || 0);
    const eliminated = projected >= state.eliminationThreshold;
    return h('tr', { className: eliminated ? 'is-eliminated-row' : '' }, [
      h('td', {}, eliminated ? `\ud83d\udc80 ${p.name}` : p.name),
      h('td', { className: 'num' }, String(projected)),
      h(
        'td',
        {},
        h('span', { className: 'status-pill ' + (eliminated ? 'eliminated' : 'active') }, eliminated ? 'ELIMINATED' : 'SAFE')
      ),
    ]);
  });

  return h('div', { className: 'elimination-preview' }, [
    h('h3', { className: 'drawer-title' }, `Elimination Check \u2014 Threshold: ${state.eliminationThreshold}`),
    h('table', { className: 'results-table' }, [
      h('thead', {}, h('tr', {}, [h('th', {}, 'Player'), h('th', {}, 'Projected Score'), h('th', {}, 'Status')])),
      h('tbody', {}, rows),
    ]),
  ]);
}

/**
 * "View All Cards" -- the full reveal of every active player's exact
 * hand at the moment SHOW was called, read from the immutable snapshot
 * (never live state), with each card's actual scoring value (Joker rule
 * included) shown using the same getCardValue() the engine itself uses.
 */
export function renderShowRevealModal(app, state) {
  const result = state.lastShowResult;
  const ordered = playersSortedByTotal(state);

  const playerBlocks = ordered.map((p) => {
    const isWinner = p.id === result.winnerId;
    const hand = (result.handsSnapshot[p.id] || []).slice().sort((a, b) => a.rank.localeCompare(b.rank) || a.suit.localeCompare(b.suit));

    const cardEls = hand.map((card) =>
      h('div', { className: 'reveal-card-wrap' }, [
        renderCard(card, { jokerCard: state.jokerCard, showZeroBadge: true }),
        h('div', { className: 'reveal-card-value' }, `= ${getCardValue(card, state.jokerCard)}`),
      ])
    );

    return h('div', { className: 'reveal-player-block' + (isWinner ? ' is-winner-block' : '') }, [
      h('div', { className: 'reveal-player-name' }, [isWinner ? '\ud83c\udfc6 ' : '', p.name.toUpperCase(), p.id === result.callerId ? ' (SHOW)' : '']),
      h('div', { className: 'reveal-cards-row' }, cardEls.length ? cardEls : [h('div', { className: 'inline-hint' }, 'No cards \u2014 empty hand.')]),
      h('div', { className: 'reveal-total' }, [`Total: ${result.totals[p.id]}`, ' \u00b7 ', `Round Score: ${state.roundScores[p.id] ?? 0}`]),
    ]);
  });

  return h('div', { className: 'overlay reveal-overlay' }, [
    h('div', { className: 'overlay-card reveal-overlay-card' }, [
      h('h2', { className: 'overlay-title' }, 'SHOW Reveal'),
      h('p', { className: 'overlay-sub' }, 'Exact hands at the moment SHOW was called.'),
      h('div', { className: 'reveal-players' }, playerBlocks),
      h('div', { className: 'screen-actions' }, [
        h('button', { className: 'btn btn-primary', onClick: () => app.closeShowReveal() }, '\u2190 Back to Results'),
      ]),
    ]),
  ]);
}

function renderRoundResult(app, state) {
  const rows = state.players
    .slice()
    .sort((a, b) => (state.cumulativeScores[a.id] ?? 0) - (state.cumulativeScores[b.id] ?? 0))
    .map((p) =>
      h('tr', {}, [
        h('td', {}, p.name),
        h('td', { className: 'num' }, String(state.roundScores[p.id] ?? 0)),
        h('td', { className: 'num' }, String(state.cumulativeScores[p.id] ?? 0)),
      ])
    );

  const table = h('table', { className: 'results-table' }, [
    h('thead', {}, h('tr', {}, [h('th', {}, 'Player'), h('th', {}, 'Round Score'), h('th', {}, 'Cumulative')])),
    h('tbody', {}, rows),
  ]);

  return overlay([
    h('div', { className: 'result-tag correct' }, `Round ${state.roundNumber} Complete`),
    h('h2', { className: 'overlay-title' }, 'Cumulative Scores'),
    h('p', { className: 'overlay-sub' }, 'No one crossed the elimination threshold this round.'),
    table,
    h('div', { className: 'screen-actions' }, [
      h('button', { className: 'btn btn-primary', onClick: () => app.continueToNextRound() }, 'Next Round'),
    ]),
  ]);
}

function renderEliminationResult(app, state) {
  const eliminatedNames = state.lastEliminated.map((id) => state.players.find((p) => p.id === id).name);

  const rows = state.players
    .slice()
    .sort((a, b) => (state.cumulativeScores[a.id] ?? 0) - (state.cumulativeScores[b.id] ?? 0))
    .map((p) =>
      h('tr', {}, [
        h('td', {}, p.name),
        h('td', { className: 'num' }, String(state.roundScores[p.id] ?? 0)),
        h('td', { className: 'num' }, String(state.cumulativeScores[p.id] ?? 0)),
        h(
          'td',
          {},
          h('span', { className: 'status-pill ' + (p.active ? 'active' : 'eliminated') }, p.active ? 'ACTIVE' : 'OUT')
        ),
      ])
    );

  const table = h('table', { className: 'results-table' }, [
    h('thead', {}, h('tr', {}, [h('th', {}, 'Player'), h('th', {}, 'Round Score'), h('th', {}, 'Cumulative'), h('th', {}, 'Status')])),
    h('tbody', {}, rows),
  ]);

  return overlay([
    h('div', { className: 'result-tag wrong' }, `Round ${state.roundNumber} Complete`),
    h('div', { className: 'elimination-banner' }, [
      h('div', { className: 'elim-title' }, 'PLAYER' + (eliminatedNames.length > 1 ? 'S' : '') + ' ELIMINATED'),
      h('div', {}, eliminatedNames.join(', ') + ` \u2014 reached the ${state.eliminationThreshold}-point threshold.`),
    ]),
    table,
    h('div', { className: 'screen-actions' }, [
      h('button', { className: 'btn btn-primary', onClick: () => app.continueToNextRound() }, 'Next Round'),
    ]),
  ]);
}

function renderGameOver(app, state) {
  const winner = state.players.find((p) => p.id === state.winnerId);
  const isSingleRound = state.gameMode === MODE.SINGLE_ROUND;

  if (isSingleRound) {
    const ordered = playersSortedByTotal(state);
    const rows = ordered.map((p, idx) =>
      h('tr', { className: p.id === winner.id ? 'is-winner' : '' }, [
        h('td', {}, `${idx + 1}${ordinalSuffix(idx + 1)}`),
        h('td', {}, p.name),
        h('td', { className: 'num' }, String(state.lastShowResult.totals[p.id])),
        h('td', { className: 'num' }, String(state.roundScores[p.id] ?? 0)),
      ])
    );

    const table = h('table', { className: 'results-table' }, [
      h('thead', {}, h('tr', {}, [h('th', {}, 'Rank'), h('th', {}, 'Player'), h('th', {}, 'Total'), h('th', {}, 'Score')])),
      h('tbody', {}, rows),
    ]);

    return overlay([
      h('div', { className: 'winner-hero' }, [
        h('div', { className: 'winner-trophy' }, '\ud83c\udfc6'),
        h('div', { className: 'winner-name' }, winner.name),
        h('div', { className: 'winner-caption' }, state.lastShowResult.correct ? 'Correct SHOW \u2014 Round Winner' : 'Lowest Total \u2014 Round Winner'),
      ]),
      table,
      h('div', { className: 'screen-actions' }, [
        h('button', { className: 'btn btn-primary', onClick: () => app.playAgain() }, 'Play Again'),
        h('button', { className: 'btn btn-secondary', onClick: () => app.goHome() }, 'Home'),
      ]),
    ]);
  }

  const eliminatedCount = state.players.filter((p) => !p.active).length;

  return overlay([
    h('div', { className: 'winner-hero' }, [
      h('div', { className: 'winner-trophy' }, '\ud83c\udfc6'),
      h('div', { className: 'winner-name' }, winner.name),
      h('div', { className: 'winner-caption' }, 'Survived All Rounds'),
    ]),
    h('div', { className: 'stat-row' }, [
      h('div', {}, [h('b', {}, String(state.roundNumber)), 'Rounds Played']),
      h('div', {}, [h('b', {}, String(state.cumulativeScores[winner.id] ?? 0)), 'Final Score']),
      h('div', {}, [h('b', {}, String(eliminatedCount)), 'Players Eliminated']),
    ]),
    h('div', { className: 'screen-actions', style: 'justify-content:center; margin-top: 24px;' }, [
      h('button', { className: 'btn btn-primary', onClick: () => app.playAgain() }, 'Play Again'),
      h('button', { className: 'btn btn-secondary', onClick: () => app.goHome() }, 'Home'),
    ]),
  ]);
}

/**
 * Pass-and-play screen. Shown whenever the device needs to change hands
 * between two local human players -- it fully covers the table and hand
 * (which are already rendered as hidden/card-backs underneath) until the
 * incoming player confirms they're holding the device.
 */
export function renderPassLockOverlay(app) {
  const state = app.gameState;
  const current = state.players[state.currentPlayerIndex];

  return h('div', { className: 'overlay pass-overlay' }, [
    h('div', { className: 'overlay-card pass-overlay-card' }, [
      h('div', { className: 'pass-icon' }, '\ud83e\udd1d'),
      h('div', { className: 'result-tag correct' }, `Round ${state.roundNumber}`),
      h('h2', { className: 'overlay-title' }, 'Pass the device'),
      h('p', { className: 'overlay-sub' }, `Hand the device to ${current.name}. No one else should be able to see the screen.`),
      h('div', { className: 'screen-actions', style: 'justify-content:center; margin-top: 22px;' }, [
        h(
          'button',
          { className: 'btn btn-primary', onClick: () => app.revealHand() },
          `I'm ${current.name} \u2014 Reveal My Hand`
        ),
        h('button', { className: 'btn btn-secondary', onClick: () => app.confirmQuitToHome() }, 'Home'),
      ]),
    ]),
  ]);
}

function ordinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}


export function renderQuitConfirmationOverlay(app) {
  return overlay([
    h('div', { className: 'result-tag wrong' }, 'Quit to Home?'),
    h('h2', { className: 'overlay-title' }, 'Leave this game?'),
    h('p', { className: 'overlay-sub' }, 'All current game progress will be permanently lost.'),
    h('div', { className: 'screen-actions', style: 'justify-content:center; margin-top: 24px;' }, [
      h('button', { className: 'btn btn-secondary', onClick: () => app.cancelQuitToHome() }, 'Cancel'),
      h('button', { className: 'btn btn-primary', onClick: () => app.executeQuitToHome() }, 'Quit to Home'),
    ]),
  ]);
}

