# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev        # start dev server at http://localhost:3000
yarn build      # production build
yarn generate   # static site generation
yarn preview    # preview production build
```

There are no tests in this project.

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

**Styling**: Tailwind CSS v4 (via `@tailwindcss/vite`) + DaisyUI. CSS entry is `app/assets/css/main.css` (two lines: import tailwind, register daisyui plugin).

## Key game logic

- **Stash**: accumulates points mid-turn without banking; requires ≥ 350 pts this roll; resets `turnPoints` to 0 and adds to `stashedPoints`
- **Bank**: commits `stashedPoints + turnPoints` to DB, advances turn to next player
- **Farkle**: records 0 points, increments `consecutiveFarkles`; on the 3rd consecutive farkle applies −1000 penalty and resets the counter
- **End game**: sets winner to the player with the highest `totalScore` among `activeGamePlayers`
- Turn advancement wraps around using modulo on `turnOrder`
