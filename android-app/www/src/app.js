// src/app.js

import { h, mount } from './utils/dom.js';
import { sounds, setSoundEnabled } from './utils/sound.js';
import {
  createGame,
  playGroup,
  exchange,
  callShow,
  finalizeRound,
  continueToNextRound,
  PHASE,
  MODE,
} from './game/engine.js';
import { decideBotAction } from './game/bot.js';
import { renderHome } from './ui/screens/home.js';
import { renderSetup, renderSettingsScreen } from './ui/screens/setup.js';
import { renderRules } from './ui/screens/rules.js';
import { renderGame } from './ui/screens/game.js';
import { renderOverlayForPhase, renderPassLockOverlay, renderShowRevealModal } from './ui/screens/overlays.js';

const BOT_ACTION_DELAY_MS = 850;

function loadSettings() {
  try {
    const raw = localStorage.getItem('scs-settings');
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore corrupted storage */
  }
  return { sound: true, animations: true };
}

function saveSettings(settings) {
  try {
    localStorage.setItem('scs-settings', JSON.stringify(settings));
  } catch {
    /* storage may be unavailable, fail silently */
  }
}

function freshPlayer(idx) {
  return { id: `p${idx}-${Math.random().toString(36).slice(2, 8)}`, name: '', isBot: idx > 0 };
}

function defaultSetupState(mode) {
  return {
    mode,
    players: [freshPlayer(0), freshPlayer(1)],
    wrongShowPenalty: 25,
    eliminationThreshold: mode === 'ELIMINATION' ? 100 : null,
    deckCount: 1,
    error: '',
  };
}

export class App {
  constructor(root) {
    this.root = root;
    this.screen = 'HOME';
    this.settings = loadSettings();
    setSoundEnabled(this.settings.sound);

    this.setupState = defaultSetupState('SINGLE_ROUND');
    this.gameState = null;
    this.selectedCardIds = [];
    this.drawerOpen = false;
    this.actionError = '';
    this.botTimer = null;

    // ---- pass-and-play (shared device) state ----
    // Tracks which player has actually confirmed the device is in their
    // hands. Whenever the current turn belongs to a different human
    // player than this, the hand stays hidden behind a "pass the
    // device" screen until they tap to reveal it.
    this.passLocked = false;
    this.lastRevealedPlayerId = null;

    // ---- animation state (recomputed from state diffs each render) ----
    this.anim = {};
    this._prevOpenCardId = null;
    this._prevRoundNumber = null;
    this._prevHandForPlayer = null;

    // "View All Cards" modal on the SHOW result screen.
    this.showRevealOpen = false;

    this.render();
  }

  render() {
    let content;
    if (this.screen === 'HOME') content = renderHome(this);
    else if (this.screen === 'SETUP') content = renderSetup(this);
    else if (this.screen === 'SETTINGS') content = renderSettingsScreen(this);
    else if (this.screen === 'RULES') content = renderRules(this);
    else if (this.screen === 'GAME') {
      this.evaluateHumanTurnLock();
      this.anim = this.computeAnimFlags();
      content = this.renderGameWithOverlay();
    }

    mount(this.root, content);
  }

  renderGameWithOverlay() {
    const wrap = h('div', {}, [renderGame(this)]);
    if (this.passLocked) {
      wrap.appendChild(renderPassLockOverlay(this));
    } else {
      const overlay = renderOverlayForPhase(this);
      if (overlay) wrap.appendChild(overlay);
      if (this.showRevealOpen && this.gameState?.lastShowResult) {
        wrap.appendChild(renderShowRevealModal(this, this.gameState));
      }
    }
    return wrap;
  }

  // ---------------- pass-and-play ----------------

  /**
   * Decides whether the "pass the device" screen should currently be
   * showing. Locks whenever gameplay is active, there are 2+ local
   * human players, and the current turn belongs to a human player who
   * hasn't yet confirmed they're holding the device. Never locks for a
   * bot's turn (bots auto-play; their hand is hidden separately) and
   * never locks with only one human at the table (nothing to pass).
   */
  evaluateHumanTurnLock() {
    const state = this.gameState;
    if (!state) {
      this.passLocked = false;
      return;
    }
    const humanCount = state.players.filter((p) => !p.isBot).length;
    if (humanCount < 2 || state.gamePhase !== PHASE.PLAYING) {
      this.passLocked = false;
      return;
    }
    const current = state.players[state.currentPlayerIndex];
    if (current.isBot) {
      this.passLocked = false;
      return;
    }
    this.passLocked = this.lastRevealedPlayerId !== current.id;
  }

  revealHand() {
    const state = this.gameState;
    if (!state) return;
    const current = state.players[state.currentPlayerIndex];
    this.lastRevealedPlayerId = current.id;
    this.passLocked = false;
    this.render();
  }

  // ---------------- animation flags ----------------

  /**
   * Diffs the current game state against what was rendered last time to
   * decide which entrance animations should play this render: the Open
   * Card "landing" when it changes, a staggered deal-in when a new round
   * begins, and a pop-in on a single freshly-drawn card after an
   * EXCHANGE. Purely derived from state, so it works the same whether
   * the change came from a human action or a bot's automatic turn.
   */
  computeAnimFlags() {
    const state = this.gameState;
    const anims = { tableAnim: null, dealAnim: false, drawnCardId: null };
    if (!state || !this.settings.animations) {
      this._prevOpenCardId = state ? state.openCard?.id : null;
      this._prevRoundNumber = state ? state.roundNumber : null;
      this._prevHandForPlayer = null;
      return anims;
    }

    if (state.gamePhase === PHASE.PLAYING) {
      if (state.openCard && state.openCard.id !== this._prevOpenCardId) {
        anims.tableAnim = 'card-landed';
      }
      if (this._prevRoundNumber !== state.roundNumber) {
        anims.dealAnim = true;
      } else {
        const cp = state.players[state.currentPlayerIndex];
        if (this._prevHandForPlayer && this._prevHandForPlayer.playerId === cp.id) {
          if (cp.hand.length > this._prevHandForPlayer.size) {
            const drawn = cp.hand.find((c) => !this._prevHandForPlayer.ids.has(c.id));
            if (drawn) anims.drawnCardId = drawn.id;
          }
        }
      }
    }

    this._prevOpenCardId = state.openCard?.id ?? null;
    this._prevRoundNumber = state.roundNumber;
    const cp = state.players[state.currentPlayerIndex];
    this._prevHandForPlayer = { playerId: cp.id, size: cp.hand.length, ids: new Set(cp.hand.map((c) => c.id)) };
    return anims;
  }

  // ---------------- navigation ----------------

  goHome() {
    this.cancelBotTimer();
    this.screen = 'HOME';
    this.gameState = null;
    this.resetPerGameUiState();
    this.render();
  }

  goToSetup(mode) {
    this.setupState = defaultSetupState(mode);
    this.screen = 'SETUP';
    this.render();
  }

  goToRules() {
    this.screen = 'RULES';
    this.render();
  }

  goToSettings() {
    this.screen = 'SETTINGS';
    this.render();
  }

  toggleSetting(key) {
    this.settings[key] = !this.settings[key];
    if (key === 'sound') setSoundEnabled(this.settings.sound);
    saveSettings(this.settings);
    this.render();
  }

  confirmQuitToHome() {
    if (window.confirm('Leave this game and return home? Progress will be lost.')) {
      this.goHome();
    }
  }

  // ---------------- setup screen actions ----------------

  updatePlayerName(idx, name) {
    this.setupState.players[idx].name = name;
  }

  setPlayerIsBot(idx, isBot) {
    this.setupState.players[idx].isBot = isBot;
    this.render();
  }

  addPlayer() {
    if (this.setupState.players.length >= 6) return;
    this.setupState.players.push(freshPlayer(this.setupState.players.length));
    this.render();
  }

  removePlayer(idx) {
    if (this.setupState.players.length <= 2) return;
    this.setupState.players.splice(idx, 1);
    this.render();
  }

  setPenalty(v) {
    if (!Number.isFinite(v) || v <= 0) return;
    this.setupState.wrongShowPenalty = v;
    this.render();
  }

  // Used by the free-typing custom-value input: updates state without a
  // full re-render, so the field never loses focus or cursor position.
  setPenaltyQuiet(v) {
    if (!Number.isFinite(v) || v <= 0) return;
    this.setupState.wrongShowPenalty = v;
  }

  setThreshold(v) {
    if (!Number.isFinite(v) || v <= 0) return;
    this.setupState.eliminationThreshold = v;
    this.render();
  }

  setThresholdQuiet(v) {
    if (!Number.isFinite(v) || v <= 0) return;
    this.setupState.eliminationThreshold = v;
  }

  setDeckCount(v) {
    if (v !== 1 && v !== 2) return;
    this.setupState.deckCount = v;
    this.render();
  }

  confirmSetup() {
    const s = this.setupState;

    if (s.players.length < 2 || s.players.length > 6) {
      s.error = 'Seven-Card Show supports 2\u20136 players.';
      this.render();
      return;
    }
    if (!s.wrongShowPenalty || s.wrongShowPenalty <= 0) {
      s.error = 'Choose a Wrong SHOW penalty greater than 0.';
      this.render();
      return;
    }
    if (s.mode === 'ELIMINATION' && (!s.eliminationThreshold || s.eliminationThreshold <= 0)) {
      s.error = 'Choose an elimination threshold greater than 0.';
      this.render();
      return;
    }

    const players = s.players.map((p, idx) => ({
      id: p.id,
      name: p.name.trim() || `Player ${idx + 1}`,
      isBot: p.isBot,
    }));

    this.gameState = createGame(players, {
      mode: s.mode,
      wrongShowPenalty: s.wrongShowPenalty,
      eliminationThreshold: s.mode === 'ELIMINATION' ? s.eliminationThreshold : null,
      deckCount: s.deckCount || 1,
    });

    this.selectedCardIds = [];
    this.actionError = '';
    this.resetPerGameUiState();
    this.screen = 'GAME';
    this.render();
    this.maybeRunBotTurn();
  }

  playAgain() {
    const mode = this.gameState.gameMode;
    const wrongShowPenalty = this.gameState.wrongShowPenalty;
    const eliminationThreshold = this.gameState.eliminationThreshold;
    const deckCount = this.gameState.deckCount;
    const players = this.gameState.players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot }));

    this.gameState = createGame(players, { mode, wrongShowPenalty, eliminationThreshold, deckCount });
    this.selectedCardIds = [];
    this.actionError = '';
    this.resetPerGameUiState();
    this.render();
    this.maybeRunBotTurn();
  }

  // Clears pass-and-play / animation tracking so a brand new game never
  // inherits lock or animation state from whatever came before it.
  resetPerGameUiState() {
    this.passLocked = false;
    this.lastRevealedPlayerId = null;
    this._prevOpenCardId = null;
    this._prevRoundNumber = null;
    this._prevHandForPlayer = null;
    this.showRevealOpen = false;
  }

  // ---------------- in-game actions ----------------

  setDrawerOpen(v) {
    this.drawerOpen = v;
    this.render();
  }

  toggleCardSelection(card) {
    const state = this.gameState;
    const player = state.players[state.currentPlayerIndex];
    if (player.isBot) return;

    if (this.selectedCardIds.length === 0) {
      this.selectedCardIds = [card.id];
    } else {
      const selectedCards = player.hand.filter((c) => this.selectedCardIds.includes(c.id));
      const currentRank = selectedCards[0]?.rank;
      if (card.rank !== currentRank) {
        this.selectedCardIds = [card.id];
      } else if (this.selectedCardIds.includes(card.id)) {
        this.selectedCardIds = this.selectedCardIds.filter((id) => id !== card.id);
      } else {
        this.selectedCardIds = [...this.selectedCardIds, card.id];
      }
    }
    this.actionError = '';
    this.render();
  }

  performPlay() {
    const state = this.gameState;
    const player = state.players[state.currentPlayerIndex];
    const result = playGroup(state, player.id, this.selectedCardIds);
    this.handleActionResult(result, 'play');
  }

  performExchange() {
    const state = this.gameState;
    const player = state.players[state.currentPlayerIndex];
    const result = exchange(state, player.id, this.selectedCardIds);
    this.handleActionResult(result, 'exchange');
  }

  performShow() {
    const state = this.gameState;
    const player = state.players[state.currentPlayerIndex];
    const result = callShow(state, player.id);
    this.handleActionResult(result, 'show');
  }

  handleActionResult(result, kind) {
    if (result.error) {
      this.actionError = result.error;
      this.render();
      return;
    }
    this.actionError = '';
    this.selectedCardIds = [];

    if (kind === 'show') {
      this.showRevealOpen = false;
    }

    if (this.settings.sound) {
      if (kind === 'play') sounds.play();
      else if (kind === 'exchange') sounds.exchange();
      else if (kind === 'show') {
        const correct = this.gameState.lastShowResult?.correct;
        correct ? sounds.showCorrect() : sounds.showWrong();
      }
    }

    this.render();
    this.maybeRunBotTurn();
  }

  // ---------------- SHOW result: view all cards ----------------

  /**
   * Returns the single local human player, but only when there is
   * exactly one -- i.e. the common "me vs bots" setup. With 2+ human
   * players sharing the device (pass-and-play), there is no single
   * "current user" the result screen can speak for, so callers should
   * treat a null return as "use player-name framing, not YOU WON/LOST."
   */
  getLocalHumanPlayer() {
    const state = this.gameState;
    if (!state) return null;
    const humans = state.players.filter((p) => !p.isBot);
    return humans.length === 1 ? humans[0] : null;
  }

  openShowReveal() {
    this.showRevealOpen = true;
    this.render();
  }

  closeShowReveal() {
    this.showRevealOpen = false;
    this.render();
  }

  continueAfterShow() {
    this.showRevealOpen = false;
    finalizeRound(this.gameState);
    if (this.settings.sound && this.gameState.lastEliminated.length > 0) sounds.eliminated();
    if (this.settings.sound && this.gameState.gamePhase === PHASE.GAME_OVER) sounds.victory();
    this.render();
  }

  continueToNextRound() {
    continueToNextRound(this.gameState);
    this.selectedCardIds = [];
    this.showRevealOpen = false;
    this.render();
    this.maybeRunBotTurn();
  }

  // ---------------- bot automation ----------------

  cancelBotTimer() {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
  }

  maybeRunBotTurn() {
    this.cancelBotTimer();
    const state = this.gameState;
    if (!state || state.gamePhase !== PHASE.PLAYING) return;

    const player = state.players[state.currentPlayerIndex];
    if (!player.isBot) return;

    this.botTimer = setTimeout(() => this.runBotTurn(), BOT_ACTION_DELAY_MS);
  }

  runBotTurn() {
    const state = this.gameState;
    if (!state || state.gamePhase !== PHASE.PLAYING) return;
    const player = state.players[state.currentPlayerIndex];
    if (!player.isBot) return;

    const action = decideBotAction(state, player);
    let result;
    if (action.type === 'SHOW') {
      result = callShow(state, player.id);
    } else if (action.type === 'PLAY') {
      result = playGroup(state, player.id, action.cardIds);
    } else {
      result = exchange(state, player.id, action.cardIds);
    }

    if (result.error) {
      // Defensive fallback: if the bot proposed something illegal,
      // exchange one arbitrary card instead of stalling the game.
      const fallbackCard = player.hand[0];
      if (fallbackCard) exchange(state, player.id, [fallbackCard.id]);
    }

    if (this.settings.sound) {
      if (action.type === 'PLAY') sounds.play();
      else if (action.type === 'EXCHANGE') sounds.exchange();
      else {
        const correct = state.lastShowResult?.correct;
        correct ? sounds.showCorrect() : sounds.showWrong();
      }
    }

    this.render();
    this.maybeRunBotTurn();
  }
}
