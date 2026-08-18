// src/ui/screens/rules.js

import { h } from '../../utils/dom.js';

const RULES = [
  'Every player starts a round with <b>7 cards</b>. Ranks A\u2013K are worth 1\u201310 (face cards count as 10).',
  'Your goal is to have the <b>lowest total hand value</b> when SHOW is called.',
  'If your card matches the Open Card\u2019s <b>rank</b> (suit doesn\u2019t matter), you may discard it \u2014 no draw, turn ends.',
  'You may discard <b>several cards of that same rank together</b> in one turn \u2014 still no draw.',
  'No matching card? <b>Exchange</b>: discard one card, or several cards of one rank, then draw exactly one replacement. Whatever you drop becomes the new Open Card, even though it didn\u2019t match.',
  'The <b>Joker</b> is revealed each round. If it\u2019s an Ace, both Aces of its color are worth <b>0</b>.',
  'SHOW unlocks once <b>every active player has completed 3 turns</b>.',
  'Calling SHOW claims your total is <b>strictly lower</b> than everyone else\u2019s \u2014 a tie still counts as wrong.',
  'A <b>wrong SHOW</b> costs you a fixed penalty instead of your hand total; the true lowest player scores 0.',
  '<b>Elimination Mode</b> adds round scores to a running total and eliminates anyone at or above the threshold, until one player survives.',
];

export function renderRules(app) {
  const panel = h('div', { className: 'screen-panel rules-panel' }, [
    h('div', { className: 'screen-actions rules-top-actions' }, [
      h('button', { className: 'btn btn-primary', onClick: () => app.goHome() }, '← Back / Home'),
    ]),
    h('h2', { className: 'screen-title', style: 'margin-top: 16px;' }, 'How to Play'),
    h('p', { className: 'screen-subtitle' }, 'The short version of everything Seven-Card Show asks of you.'),
    h(
      'div',
      { className: 'rules-list' },
      RULES.map((text, i) => {
        const item = h('div', { className: 'rule-item' }, [
          h('span', { className: 'rule-num' }, String(i + 1).padStart(2, '0')),
          h('p', { className: 'rule-text' }),
        ]);
        item.lastChild.innerHTML = text;
        return item;
      })
    ),
  ]);
  return h('div', { className: 'screen' }, [panel]);
}
