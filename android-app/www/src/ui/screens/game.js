// src/ui/screens/game.js

import { h } from '../../utils/dom.js';
import { renderCard, renderCardBack } from '../components/card.js';
import { renderDrawer } from '../components/drawer.js';
import { calculateHandTotal, jokerEffectDescription } from '../../game/joker.js';
import { canMatch, canPlayGroup, canExchange } from '../../game/rules.js';
import { isShowAvailable, MODE } from '../../game/engine.js';

export function renderGame(app) {
  const state = app.gameState;
  const currentPlayer = state.players[state.currentPlayerIndex];
  const isHumanTurn = !currentPlayer.isBot;

  let bottomPlayer = currentPlayer;
  if (bottomPlayer.isBot) {
    const localHuman = app.getLocalHumanPlayer();
    if (localHuman) {
      bottomPlayer = localHuman;
    } else {
      bottomPlayer = state.players.find((p) => !p.isBot) || bottomPlayer;
    }
  }

  const wrapper = h('div', { className: 'game-screen' }, [
    renderTopbar(app, state),
    h('div', { className: 'game-middle' }, [renderOpponentsRow(state), renderTableCenter(app, state)]),
    renderHandArea(app, state, bottomPlayer, isHumanTurn),
    renderDrawer(app),
    h('div', { id: 'toast', className: 'toast' }),
  ]);

  return wrapper;
}

function renderTopbar(app, state) {
  return h('div', { className: 'game-topbar' }, [
    h('div', { className: 'brand' }, 'Seven-Card Show'),
    h('div', { className: 'turn-meta' }, [
      h('span', {}, ['ROUND ', h('strong', {}, String(state.roundNumber))]),
      h('span', {}, ['TURN ', h('strong', {}, String(totalTurns(state)))]),
      h('span', {}, ['CURRENT ', h('strong', {}, state.players[state.currentPlayerIndex].name.toUpperCase())]),
      h('span', {}, ['SHOW ', h('strong', {}, isShowAvailable(state) ? 'AVAILABLE' : 'LOCKED')]),
      state.gameMode === MODE.ELIMINATION
        ? h('span', {}, ['THRESHOLD ', h('strong', {}, String(state.eliminationThreshold))])
        : null,
    ]),
    h('div', { className: 'topbar-buttons' }, [
      h('button', { className: 'icon-btn', onClick: () => app.setDrawerOpen(true) }, 'Scoreboard'),
      h('button', { className: 'icon-btn', onClick: () => app.confirmQuitToHome() }, 'Home'),
    ]),
  ]);
}

function totalTurns(state) {
  return state.players.reduce((sum, p) => sum + p.turnsCompleted, 0) + 1;
}

function renderOpponentsRow(state) {
  const plaques = state.players.map((p, idx) => {
    const isTurn = idx === state.currentPlayerIndex;
    const classes = ['opponent-plaque'];
    if (isTurn) classes.push('is-turn');
    if (!p.active) classes.push('is-eliminated');

    return h('div', { id: `plaque-${p.id}`, className: classes.join(' ') }, [
      isTurn ? h('div', { className: 'opponent-turn-tag' }, 'TURN') : null,
      !p.active ? h('div', { className: 'eliminated-tag' }, 'OUT') : null,
      h('div', { className: 'opponent-name' }, p.name),
      p.isBot ? h('div', { className: 'opponent-bot-tag' }, 'BOT') : null,
      h('div', { className: 'opponent-meta' }, [
        h('span', {}, `${p.hand.length} cards`),
        h('span', {}, `${state.cumulativeScores[p.id] ?? 0} pts`),
      ]),
    ]);
  });

  return h('div', { className: 'opponents-row' }, plaques);
}

function renderTableCenter(app, state) {
  const anim = app.anim || {};

  const jokerSlot = h('div', { className: 'center-slot joker-slot' }, [
    h('div', { className: 'center-slot-label' }, 'Joker'),
    h('div', { className: 'joker-glow' }, renderCard(state.jokerCard, { isJoker: true })),
    h('div', { className: 'joker-effect-tag' }, jokerEffectDescription(state.jokerCard) || 'No zero-value effect'),
  ]);

  // A couple of faded "ghost" cards behind the Open Card make the
  // discard pile visually obvious even when a matching play keeps the
  // same rank on top (e.g. discarding 7♦ onto 7♥ -- same rank, new card).
  const ghosts =
    state.discardPile.length > 0
      ? [
          h('div', { className: 'stack-ghost stack-ghost-1' }),
          h('div', { className: 'stack-ghost stack-ghost-2' }),
        ]
      : [];

  const openSlot = h('div', { className: 'center-slot open-card-slot' }, [
    h('div', { className: 'center-slot-label' }, 'Open Card'),
    h('div', { className: 'open-card-stack' }, [
      ...ghosts,
      renderCard(state.openCard, {
        showZeroBadge: true,
        jokerCard: state.jokerCard,
        animClass: anim.tableAnim || '',
      }),
    ]),
    h('div', { className: 'draw-pile-count' }, `${state.discardPile.length} in pile`),
  ]);

  const drawSlot = h('div', { className: 'center-slot' }, [
    h('div', { className: 'center-slot-label' }, 'Draw Pile'),
    h('div', { className: 'draw-pile-stack' }, [renderCardBack()]),
    h('div', { className: 'draw-pile-count' }, `${state.drawPile.length} left`),
  ]);

  return h('div', { className: 'table-center' }, [h('div', { className: 'table-felt' }, [jokerSlot, openSlot, drawSlot])]);
}

function renderHandArea(app, state, player, isHumanTurn) {
  // The hand is only ever revealed for the actual local human whose turn
  // it is, right now. A bot's real cards are never rendered to the DOM
  // (only card backs) -- and on a shared/pass-and-play device, a human
  // player's cards stay hidden behind card backs until that player has
  // tapped to reveal them (see app.passLocked / revealHand()).
  const shouldReveal = !app.passLocked;

  if (!shouldReveal) {
    return renderHiddenHandArea(state, player);
  }

  const myTotal = calculateHandTotal(player.hand, state.jokerCard);
  const selected = app.selectedCardIds;
  const anim = app.anim || {};

  const hasMatch = player.hand.some((c) => canMatch(c, state.openCard));
  const selectedCards = player.hand.filter((c) => selected.includes(c.id));

  const canPlay = isHumanTurn && !app.isAnimating && hasMatch && canPlayGroup(selectedCards, state.openCard);
  const canDoExchange = isHumanTurn && !app.isAnimating && canExchange(selectedCards);
  const showAvailable = isShowAvailable(state);
  const canCallShow = isHumanTurn && !app.isAnimating && showAvailable;

  const hand = player.hand.slice();

  const cardEls = hand.map((card, idx) => {
    const classes = [];
    if (anim.dealAnim) classes.push('card-deal-in');
    if (anim.drawnCardId === card.id) classes.push('card-pop-in');
    if (app.drawnCardId === card.id) {
      if (app.animatingStep === 'DISCARD' || app.animatingStep === 'DRAW') {
        classes.push('hidden-during-anim');
      } else if (app.animatingStep === 'REVEAL') {
        classes.push('new-card-glow');
      }
    }
    return renderCard(card, {
      selected: selected.includes(card.id),
      selectable: isHumanTurn && !app.isAnimating,
      jokerCard: state.jokerCard,
      showZeroBadge: true,
      onClick: (c) => app.toggleCardSelection(c),
      animClass: classes.join(' '),
      animDelay: anim.dealAnim ? idx * 45 : 0,
      animDelay: anim.dealAnim ? idx * 60 : 0,
    });
  });

  const header = h('div', { className: 'hand-header' }, [
    h('div', { className: 'you-status' }, [
      `${player.name}'s turn \u2014 `,
      h('strong', {}, `${myTotal} pts`),
      ` \u00b7 ${player.hand.length} card${player.hand.length === 1 ? '' : 's'} \u00b7 ${player.turnsCompleted} turn${player.turnsCompleted === 1 ? '' : 's'} played`,
    ]),
  ]);

  const actionBar = h('div', { className: 'action-bar' }, [
    h(
      'button',
      {
        className: 'action-btn play',
        disabled: !canPlay,
        onClick: () => app.performPlay(),
      },
      ['PLAY', h('small', {}, 'discard matching')]
    ),
    h(
      'button',
      {
        className: 'action-btn exchange',
        disabled: !canDoExchange,
        onClick: () => app.performExchange(),
      },
      ['EXCHANGE', h('small', {}, 'discard + draw one')]
    ),
    h(
      'button',
      {
        className: 'action-btn show' + (canCallShow ? ' available' : ''),
        disabled: !canCallShow,
        onClick: () => app.performShow(),
      },
      ['SHOW', h('small', {}, showAvailable ? 'AVAILABLE' : 'LOCKED \u2014 needs 3 turns each')]
    ),
  ]);

  const currentPlayer = state.players[state.currentPlayerIndex];
  const hint = h('div', { className: 'inline-hint' + (app.actionError ? ' is-error' : '') }, app.actionError || hintText(hasMatch, selected.length, isHumanTurn, currentPlayer.name));

  return h('div', { className: 'hand-area' }, [header, h('div', { className: 'hand-cards' }, cardEls), actionBar, hint]);
}

/**
 * Rendered whenever the current player's real cards must NOT be shown:
 * it's a bot's turn (bots' hands are never exposed in the UI), or it's
 * a human's turn but the device hasn't been handed to them yet
 * (pass-and-play). Only card backs and the public card count are shown.
 */
function renderHiddenHandArea(state, player) {
  const backs = player.hand.map(() => renderCardBack());
  const statusText = player.isBot ? `${player.name} is thinking\u2026` : `Waiting for ${player.name}\u2026`;

  const header = h('div', { className: 'hand-header' }, [
    h('div', { className: 'you-status' }, [
      statusText,
      ` \u00b7 ${player.hand.length} card${player.hand.length === 1 ? '' : 's'} \u00b7 ${player.turnsCompleted} turn${player.turnsCompleted === 1 ? '' : 's'} played`,
    ]),
  ]);

  const actionBar = h('div', { className: 'action-bar' }, [
    h('button', { className: 'action-btn play', disabled: true }, ['PLAY / DISCARD', h('small', {}, 'not your turn')]),
    h('button', { className: 'action-btn exchange', disabled: true }, ['EXCHANGE', h('small', {}, 'not your turn')]),
    h('button', { className: 'action-btn show', disabled: true }, ['SHOW', h('small', {}, 'not your turn')]),
  ]);

  const hint = h(
    'div',
    { className: 'inline-hint' },
    player.isBot ? '' : 'This hand is hidden until the device is passed and revealed.'
  );

  return h('div', { className: 'hand-area' }, [
    header,
    h('div', { className: 'hand-cards hand-cards-hidden' }, backs),
    actionBar,
    hint,
  ]);
}

function hintText(hasMatch, selectedCount, isHumanTurn, currentPlayerName) {
  if (!isHumanTurn) return `Waiting for ${currentPlayerName} \u2026`;
  return ''; // Replaced verbose instructions with empty string for cleaner UI
}
