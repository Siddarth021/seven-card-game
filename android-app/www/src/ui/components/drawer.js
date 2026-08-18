// src/ui/components/drawer.js

import { h } from '../../utils/dom.js';
import { MODE } from '../../game/engine.js';

export function renderDrawer(app) {
  const state = app.gameState;
  const isOpen = app.drawerOpen;

  const scrim = h('div', {
    className: 'drawer-scrim' + (isOpen ? ' open' : ''),
    onClick: () => app.setDrawerOpen(false),
  });

  const rows = state.players.map((p) => {
    const nearThreshold =
      state.gameMode === MODE.ELIMINATION &&
      p.active &&
      state.eliminationThreshold - state.cumulativeScores[p.id] <= 20 &&
      state.eliminationThreshold - state.cumulativeScores[p.id] > 0;

    return h('tr', {}, [
      h('td', {}, [
        p.name,
        nearThreshold
          ? h('div', { className: 'threshold-warning' }, `\u26A0 ${state.eliminationThreshold - state.cumulativeScores[p.id]} from elimination`)
          : null,
      ]),
      h('td', { className: 'num' }, String(state.cumulativeScores[p.id] ?? 0)),
      h(
        'td',
        {},
        h(
          'span',
          { className: 'status-pill ' + (p.active ? 'active' : 'eliminated') },
          p.active ? 'ACTIVE' : 'OUT'
        )
      ),
    ]);
  });

  const scoreTable = h('table', { className: 'score-table' }, [
    h('thead', {}, h('tr', {}, [h('th', {}, 'Player'), h('th', {}, 'Score'), h('th', {}, 'Status')])),
    h('tbody', {}, rows),
  ]);

  const logItems = state.eventLog
    .slice()
    .reverse()
    .slice(0, 60)
    .map((msg) => h('div', {}, msg));

  const drawer = h('div', { className: 'side-drawer' + (isOpen ? ' open' : '') }, [
    h('h3', { className: 'drawer-title' }, 'Scoreboard'),
    scoreTable,
    h('h3', { className: 'drawer-title' }, 'Table Log'),
    h('div', { className: 'event-log' }, logItems.length ? logItems : [h('div', {}, 'Nothing has happened yet.')]),
    h('button', { className: 'btn btn-secondary', onClick: () => app.setDrawerOpen(false) }, 'Close'),
  ]);

  return h('div', {}, [scrim, drawer]);
}
