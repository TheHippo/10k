# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev        # start dev server at http://localhost:3000
yarn build      # production build
yarn generate   # static site generation
yarn preview    # preview production build

yarn test           # run the Vitest suite once
yarn test:watch     # watch mode
yarn test:coverage  # run with a v8 coverage report over app/**
```

## What this is

A browser-only scorekeeper for the dice game **10,000** (also called Farkle/Zilch). All state is persisted in-browser via IndexedDB (Dexie). There is no backend. SSR is disabled (`ssr: false` in `nuxt.config.ts`).

See `Rules.md` for the full game rules — scoring, farkle penalties, 350-point minimums, and winning conditions.

## Architecture

Single-page Nuxt 4 app. For using Nuxt read the documentation from https://nuxt.com/llms.txt.

**Data layer** (`app/db/index.ts`): Dexie database named `10k-db` with four tables:
- `games` — one active game at a time, tracks `status`, `currentGamePlayerId`, `winnerGamePlayerId`
- `players` — persistent player registry across games
- `gamePlayers` — join table linking players to a game, stores `totalScore`, `consecutiveFarkles`, `turnOrder`
- `turns` — immutable turn log per game

For styling DaisyUI is used. See https://daisyui.com/llms.txt for more information.
DaisyUI is based on TailwindCSS, the documentation therefor can be found here: https://raw.githubusercontent.com/tailwindlabs/tailwindcss.com/refs/heads/md-endpoints/llms.txt. 

**Reactivity** (`app/composables/useLiveQuery.ts`): thin wrapper around Dexie's `liveQuery` that returns a Vue `Ref` and auto-unsubscribes on component unmount. All DB reads in `index.vue` go through this.

**Styling**: Tailwind CSS v4 (via `@tailwindcss/vite`) + DaisyUI 5. CSS entry is
`app/assets/css/main.css`. No theme is pinned, so DaisyUI follows
`prefers-color-scheme` — check both light and dark when changing styles.

Conventions (keep these consistent when adding UI):
- Colors come from DaisyUI semantic tokens only — no raw Tailwind palette
  (`bg-gray-800`) and no hand-rolled `rounded-*`/`border-*`.
- Button variants by meaning: `primary` confirm/advance, `neutral` secondary,
  `ghost` dismiss/cancel, `error` destructive, `warning` farkle, `success` bank,
  `info` stash.
- Button sizes by context: modal actions default, page/card actions `btn-sm`.
- Class order: `btn btn-{variant} btn-{size} btn-{shape}`.
- Muted text: `/60` secondary, `/30` disabled or empty.
- Icon-only buttons must carry an `aria-label`.
- Shared shells live in `app/components/`: `AppCard`, `AppModal`, `AppToast`,
  `PageHeader`, `EmptyState`. Prefer these over repeating the markup.

## Testing

Vitest via `@nuxt/test-utils` (`environment: 'nuxt'`, `happy-dom`), with
`fake-indexeddb` standing in for IndexedDB. Specs live in `tests/**/*.spec.ts`.
CI runs `yarn test:coverage` on push to master and on PRs.

Note that `playwright` appears in `node_modules` only as an optional peer dependency
of `@nuxt/test-utils` — there is no Playwright suite or config in this project.

Helpers in `tests/setup/`:
- `fixtures.ts` — `seedPlayers`, `seedActiveGame`, `seedTurns`, `seedFinishedGame`.
  `seedTurns` deliberately replays through the real engine rather than writing
  projections directly, so seeded state matches what a real game would produce.
- `dom.ts` — `getButton`/`clickButton` resolve buttons by **accessible name**
  (visible text or `aria-label`), never by DaisyUI class, so restyling does not
  break the suite. They throw on an ambiguous name; use `dialogTitled()` to scope
  a query to one dialog.
- `mount.ts` — `mountWithStubs` wraps `mountSuspended` and stubs `Icon`.
- `reset-db.ts` — the DB is recreated before each test.

## Key game logic

- **Stash**: accumulates points mid-turn without banking; requires ≥ 350 pts this roll; resets `turnPoints` to 0 and adds to `stashedPoints`
- **Bank**: commits `stashedPoints + turnPoints` to DB, advances turn to next player
- **Farkle**: records 0 points, increments `consecutiveFarkles`; on the 3rd consecutive farkle applies −1000 penalty and resets the counter
- **End game**: sets winner to the player with the highest `totalScore`; ties go to the
  earliest turn order
- Turn advancement wraps around using modulo on `turnOrder`

`app/game/deriveGameState.ts` is a pure replay of the turn log — it is the single
source of truth for scores, farkle streaks, penalties, round grouping, and whose
turn it is. `app/game/engine.ts` holds the DB-side commands (`recordBank`,
`recordFarkle`, `undoLastTurn`, `endGame`, `startGame`) and writes the projection
onto `gamePlayers`/`games`. Add game rules to `deriveGameState`, not to components.

The 10,000 target is **not** enforced: `endGame` is manual and simply picks the
highest scorer, so a winner may be below `WIN_TARGET`. The history page labels such
games "Aborted". The "every other player gets one final turn" rule from `Rules.md`
is likewise not implemented.
