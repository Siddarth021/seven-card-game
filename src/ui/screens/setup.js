// src/ui/screens/setup.js

import { h } from '../../utils/dom.js';

const PENALTY_PRESETS = [10, 15, 20, 25, 30, 50];
const THRESHOLD_PRESETS = [50, 75, 100, 150, 200];
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;

export function renderSetup(app) {
  const s = app.setupState;
  const isElimination = s.mode === 'ELIMINATION';

  const panel = h('div', { className: 'screen-panel' }, [
    h('h2', { className: 'screen-title' }, isElimination ? 'Elimination Setup' : 'Single Round Setup'),
    h(
      'p',
      { className: 'screen-subtitle' },
      isElimination
        ? 'Choose your table, an elimination threshold, and a Wrong SHOW penalty.'
        : 'Choose your table and a Wrong SHOW penalty. The game ends after one round.'
    ),
    s.error ? h('div', { className: 'error-banner' }, s.error) : null,
    renderPlayersField(app, s),
    renderDeckField(app, s),
    renderPenaltyField(app, s),
    isElimination ? renderThresholdField(app, s) : null,
    h('div', { className: 'screen-actions' }, [
      h('button', { className: 'btn btn-secondary', onClick: () => app.goHome() }, 'Back'),
      h('button', { className: 'btn btn-primary', onClick: () => app.confirmSetup() }, 'Start Game'),
    ]),
  ]);

  return h('div', { className: 'screen' }, [panel]);
}

function renderPlayersField(app, s) {
  const rows = s.players.map((p, idx) =>
    h('div', { className: 'player-row' }, [
      h('input', {
        className: 'text-input',
        value: p.name,
        placeholder: `Player ${idx + 1}`,
        oninput: (e) => app.updatePlayerName(idx, e.target.value),
      }),
      h('div', { className: 'chip-toggle' }, [
        h(
          'button',
          { className: p.isBot ? '' : 'active', onClick: () => app.setPlayerIsBot(idx, false) },
          'Human'
        ),
        h(
          'button',
          { className: p.isBot ? 'active' : '', onClick: () => app.setPlayerIsBot(idx, true) },
          'Bot'
        ),
      ]),
      s.players.length > MIN_PLAYERS
        ? h('button', { className: 'remove-player', onClick: () => app.removePlayer(idx), title: 'Remove player' }, '\u2715')
        : h('span', { className: 'remove-player' }, ''),
    ])
  );

  return h('div', { className: 'field-group' }, [
    h('label', { className: 'field-label' }, `Players (${s.players.length} / ${MAX_PLAYERS})`),
    ...rows,
    s.players.length < MAX_PLAYERS
      ? h('button', { className: 'btn btn-secondary', onClick: () => app.addPlayer() }, '+ Add Player')
      : null,
  ]);
}

function renderDeckField(app, s) {
  return h('div', { className: 'field-group' }, [
    h('label', { className: 'field-label' }, 'Deck'),
    h('div', { className: 'chip-toggle' }, [
      h(
        'button',
        { className: s.deckCount === 1 ? 'active' : '', onClick: () => app.setDeckCount(1) },
        '1 Deck \u00b7 52 cards'
      ),
      h(
        'button',
        { className: s.deckCount === 2 ? 'active' : '', onClick: () => app.setDeckCount(2) },
        '2 Decks \u00b7 104 cards'
      ),
    ]),
    h(
      'p',
      { className: 'field-hint' },
      s.deckCount === 2
        ? 'Two shuffled-together decks \u2014 more cards in play, less swing at bigger tables.'
        : 'The standard single 52-card deck.'
    ),
  ]);
}

function renderPenaltyField(app, s) {
  return h('div', { className: 'field-group' }, [
    h('label', { className: 'field-label' }, 'Wrong SHOW Penalty'),
    h(
      'div',
      { className: 'preset-row' },
      PENALTY_PRESETS.map((v) =>
        h(
          'button',
          {
            className: 'preset-chip' + (s.wrongShowPenalty === v ? ' active' : ''),
            onClick: () => app.setPenalty(v),
          },
          String(v)
        )
      )
    ),
    h('input', {
      className: 'text-input',
      type: 'number',
      min: '1',
      value: s.wrongShowPenalty,
      placeholder: 'Custom penalty',
      oninput: (e) => app.setPenaltyQuiet(Number(e.target.value)),
    }),
  ]);
}

function renderThresholdField(app, s) {
  return h('div', { className: 'field-group' }, [
    h('label', { className: 'field-label' }, 'Elimination Threshold'),
    h(
      'div',
      { className: 'preset-row' },
      THRESHOLD_PRESETS.map((v) =>
        h(
          'button',
          {
            className: 'preset-chip' + (s.eliminationThreshold === v ? ' active' : ''),
            onClick: () => app.setThreshold(v),
          },
          String(v)
        )
      )
    ),
    h('input', {
      className: 'text-input',
      type: 'number',
      min: '1',
      value: s.eliminationThreshold,
      placeholder: 'Custom threshold',
      oninput: (e) => app.setThresholdQuiet(Number(e.target.value)),
    }),
  ]);
}

export function renderSettingsScreen(app) {
  const settings = app.settings;
  const panel = h('div', { className: 'screen-panel' }, [
    h('h2', { className: 'screen-title' }, 'Settings'),
    h('p', { className: 'screen-subtitle' }, 'Adjust sound and animation preferences.'),
    settingRow('Sound', settings.sound, () => app.toggleSetting('sound')),
    settingRow('Animations', settings.animations, () => app.toggleSetting('animations')),
    h('div', { className: 'screen-actions' }, [
      h('button', { className: 'btn btn-secondary', onClick: () => app.goHome() }, 'Back to Home'),
    ]),
  ]);
  return h('div', { className: 'screen' }, [panel]);
}

function settingRow(label, value, onToggle) {
  return h('div', { className: 'field-group' }, [
    h('label', { className: 'field-label' }, label),
    h('div', { className: 'chip-toggle' }, [
      h('button', { className: value ? '' : 'active', onClick: () => onToggle() }, 'Off'),
      h('button', { className: value ? 'active' : '', onClick: () => onToggle() }, 'On'),
    ]),
  ]);
}
