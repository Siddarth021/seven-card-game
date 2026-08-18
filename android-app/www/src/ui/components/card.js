// src/ui/components/card.js

import { h } from '../../utils/dom.js';
import { SUIT_SYMBOL } from '../../game/cards.js';
import { getCardValue } from '../../game/joker.js';

/**
 * renderCard(card, options)
 * options: { selected, selectable, disabled, showZeroBadge, jokerCard, onClick, isJoker }
 */
export function renderCard(card, options = {}) {
  const {
    selected = false,
    selectable = false,
    disabled = false,
    showZeroBadge = false,
    jokerCard = null,
    onClick = null,
    isJoker = false,
    animClass = '',
    animDelay = 0,
  } = options;

  const classes = ['pcard', card.color];
  if (selected) classes.push('selected');
  if (selectable) classes.push('selectable');
  if (disabled) classes.push('disabled-card');
  if (isJoker) classes.push('joker-card');
  if (animClass) classes.push(...animClass.split(' ').filter(Boolean));

  const isZero = showZeroBadge && jokerCard && getCardValue(card, jokerCard) === 0;
  if (isZero) classes.push('zero-value');

  const symbol = SUIT_SYMBOL[card.suit];

  return h(
    'div',
    {
      className: classes.join(' '),
      style: animDelay ? `animation-delay:${animDelay}ms` : undefined,
      onClick: selectable && onClick ? () => onClick(card) : null,
      title: `${card.rank}${symbol}`,
      role: selectable ? 'button' : undefined,
      tabIndex: selectable ? 0 : undefined,
    },
    [
      h('span', { className: 'rank' }, card.rank),
      h('span', { className: 'suit-center' }, symbol),
      h('span', { className: 'rank bottom' }, card.rank),
    ]
  );
}

export function renderCardBack(options = {}) {
  const { animClass = '', animDelay = 0 } = options;
  const classes = ['pcard', 'card-back'];
  if (animClass) classes.push(...animClass.split(' ').filter(Boolean));
  return h('div', {
    className: classes.join(' '),
    style: animDelay ? `animation-delay:${animDelay}ms` : undefined,
  });
}
