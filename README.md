# Seven-Card Show

An original card game about shedding value and gambling on the reveal.
Everyone starts with 7 cards. You can throw them away in matching
groups for free, or sacrifice cards for a fresh draw. Once the table
has played enough, someone can call **SHOW** — a claim that they hold
the strictly lowest total. Call it right and you score nothing. Call
it wrong and you pay the penalty.

## Concept

- Standard 52-card deck. A = 1, 2–10 = face value, J/Q/K = 10.
- Each round reveals a **Joker** card. If it's an Ace, both Aces of
  its color are worth 0 for the round.
- On your turn: if a card in your hand matches the Open Card's rank
  (suit doesn't matter), discard it — or several of that rank at once
  — with no draw. If nothing matches, discard one card (or several of
  one rank) and draw exactly one replacement.
- Hands can shrink permanently, all the way to zero.
- **SHOW** unlocks once every active player has completed 3 turns. The
  caller must be *strictly* below everyone else — a tie is a wrong
  SHOW. Correct SHOW: caller scores 0, everyone else scores their hand
  total. Wrong SHOW: the true lowest player scores 0, the caller pays
  a fixed penalty, everyone else scores their hand total.

## Modes

- **Single Round** — one round, one result, game over.
- **Elimination** — round scores accumulate; anyone at or above the
  chosen threshold is eliminated (`>=`, not `>`), possibly several
  players at once. Play continues, with the starting player rotating
  each round, until exactly one player remains.

## Features

- Full rules engine: matching play, multi-card matching, discard +
  exchange, Joker zero-value rule, draw-pile recycling, strict SHOW
  validation with tie handling, elimination processing, starting-
  player rotation that skips eliminated players.
- Two game modes with configurable Wrong SHOW penalty and (for
  Elimination) an elimination threshold, with presets and custom
  values.
- 2–6 players, any mix of human and bot. Bots only ever look at their
  own hand and public information (never at hidden opponent cards)
  and decide when to play, exchange, or gamble on SHOW.
- A designed-from-scratch UI: a lounge-table aesthetic with a lit
  Joker slot, an animated SHOW button that visibly "unlocks," result
  overlays for SHOW / round / elimination / final winner, a
  scoreboard + table-log drawer, and small procedural sound effects
  (no external audio assets).
- Responsive down to mobile, with a card-scroll hand on small screens.
- Zero third-party runtime dependencies — no bundler, no npm install
  of packages required to run it.
- **Pass-and-play safe on a shared device**: a bot's hand is never
  rendered to the DOM (card backs only), and whenever the turn passes
  to a different local human player, a full-screen "pass the device"
  screen covers the table until that player taps to reveal their own
  hand.
- Optional 2-deck mode (104 cards) alongside the standard single
  52-card deck, chosen at setup.
- Card-motion animations (Open Card landing, dealt-hand stagger, a
  pop-in on the card you just drew) that respect the Animations
  on/off setting.

## Recent changes

- Fixed: a bot's actual hand was being rendered into the DOM once it
  became their turn (only unclickable, but visible). Bots' hands are
  now always hidden behind card backs.
- Added: a pass-and-play lock screen for shared-device local
  multiplayer, so opponents can't see your hand before you've tapped
  to reveal it.
- Added: Open Card drop-in animation, a discard-pile "ghost stack" so
  the pile visibly grows even when a matching play keeps the same rank
  on top, a dealt-hand stagger animation, and a pop-in on newly drawn
  cards.
- Added: an optional 2-deck (104-card) mode at setup, for larger
  tables or less card-count swing.
- Investigated a reported "bot bias": the shuffle is a standard
  Fisher–Yates and bots only ever see their own hand and public game
  state (never hidden opponent cards) — no bias found. The Joker's
  zero-value effect only triggers when the Joker itself is an Ace
  (per the spec), which happens for about 1 in 13 rounds.
- **Fixed: EXCHANGE now updates the Open Card.** Previously, a
  non-matching discard-and-draw (EXCHANGE) sent the discarded card(s)
  to the discard pile but left the old Open Card showing, so the next
  player was still matching against a stale rank. The Open Card is
  genuinely global, single, shared state (`state.openCard` — there is
  no per-player copy anywhere): whichever card was dropped *last*,
  whether via a matching PLAY or a non-matching EXCHANGE, is now
  always the new Open Card, and the previous one simply joins the
  discard pile. Three new engine tests lock this in (a non-matching
  exchange updating the Open Card, a multi-card exchange landing on
  the last card in the group, and a three-player chain of
  exchange → play → play all updating the same shared value).
  Because the UI's drop animation already keys off `openCard.id`
  changing, fixing the engine state made the drop animation start
  playing correctly for exchanges too, with no UI code changes needed.

## Tech stack

Plain HTML, CSS, and ES modules, served by a ~40-line dependency-free
Node.js static file server. This was a deliberate substitution for the
React/Vite stack the spec suggested: this environment has no outbound
network access, so packages could not be installed from npm. The
architecture (a UI-agnostic `game/` engine plus a thin rendering layer)
was kept exactly as specified — swapping in React later would mean
replacing `src/ui/` and `src/app.js` without touching anything in
`src/game/`.

## Installation & running locally

Requires Node.js 18+.

```bash
npm install    # no-op: there are no dependencies to install
npm run dev
```

Then open the printed URL — by default:

```
http://localhost:5173
```

## Building for production

There is no build step; the app is already static.

```bash
npm run build   # prints a short confirmation message
```

To deploy, copy `index.html` and `src/` to any static file host, or
keep using `node server.js` (set `PORT` to change the port).

## Testing

```bash
npm test
```

This runs two suites:

- `tests/engine.test.js` — unit tests covering the 25 validation
  scenarios from the spec (deck integrity, joker math, matching
  rules, exchange rules, draw-pile recycling, SHOW validation and
  ties, scoring, threshold elimination including simultaneous
  eliminations, and game-end conditions), plus a couple of extras
  (hand-total summation, starting-player rotation).
- `tests/simulate.js` — full bot-vs-bot games played end-to-end
  through the real engine (Single Round and Elimination, 2–6
  players, dozens of randomized configurations) to catch integration
  issues unit tests can't reach, such as draw-pile exhaustion over a
  long round.

All 29 checks pass as of this build.

## Project structure

```
seven-card-show/
├── index.html
├── server.js              # zero-dependency static file server
├── package.json
├── src/
│   ├── main.js             # entry point
│   ├── app.js               # screen routing, game actions, bot loop
│   ├── game/                 # UI-agnostic rules engine
│   │   ├── cards.js            # deck model, shuffle
│   │   ├── joker.js             # zero-value rule, hand totals
│   │   ├── rules.js              # matching / exchange validation
│   │   ├── engine.js              # state, turns, SHOW, elimination
│   │   └── bot.js                  # bot decision-making
│   ├── ui/
│   │   ├── screens/                # home, setup, rules, game, overlays
│   │   └── components/              # card, drawer
│   ├── utils/
│   │   ├── dom.js                    # tiny hyperscript-style helper
│   │   └── sound.js                   # procedural WebAudio effects
│   └── styles/main.css
└── tests/
    ├── engine.test.js
    └── simulate.js
```

## Known limitations

- No online multiplayer. Multiple players share one browser tab in
  pass-and-play style, which is the local game the spec asked for
  first; the engine/UI split was kept intentionally so networking
  could be added later without touching `src/game/`.
- Bots use a straightforward heuristic (shed the largest matching
  group; exchange the largest same-rank group of the highest value;
  gamble on SHOW when their own total looks safe relative to opponent
  hand sizes). They are not a game-theoretic optimal player.
- Card art is built entirely from CSS/DOM (rank + suit glyph), not
  illustrated artwork — kept simple and original by design.
- Sound effects are short procedural tones, not sampled audio.

## Future multiplayer possibilities

The engine in `src/game/` never touches the DOM and returns plain
serializable state, so it's a reasonable candidate to move behind a
WebSocket-based, server-authoritative service later: rooms/room codes,
per-socket hidden-hand delivery, reconnection, and turn validation
would all sit in a new server layer that calls the same
`playGroup` / `exchange` / `callShow` / `finalizeRound` functions this
version already uses locally.
