// src/ui/screens/home.js

import { h } from '../../utils/dom.js';

export function renderHome(app) {
  return h('div', { className: 'home-screen' }, [
    h('div', { className: 'home-eyebrow' }, 'An Original Card Game'),
    h('h1', { className: 'home-title' }, ['SEVEN-CARD', h('br'), h('em', {}, 'SHOW')]),
    h('p', { className: 'home-subtitle' }, 'Reduce your cards. Risk the SHOW. Survive the rounds.'),
    h('div', { className: 'home-actions' }, [
      h('button', { className: 'btn btn-primary', onClick: () => app.goToSetup('SINGLE_ROUND') }, 'Play Single Round'),
      h('button', { className: 'btn btn-primary', onClick: () => app.goToSetup('ELIMINATION') }, 'Play Elimination'),
      h('button', { className: 'btn btn-secondary', onClick: () => app.goToRules() }, 'How to Play'),
      h('button', { className: 'btn btn-ghost', onClick: () => app.goToSettings() }, 'Settings'),
    ]),
  ]);
}
