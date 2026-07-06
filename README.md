# 10K

A browser-only scorekeeper for the dice game **10,000** (also known as Farkle or Zilch). See [`Rules.md`](./Rules.md) for the full rules — scoring combinations, farkle penalties, the 350-point minimum to bank, and winning conditions.

There is no backend: all game and player data is persisted locally in the browser via IndexedDB (using [Dexie](https://dexie.org/)).

## Tech stack

- [Nuxt 4](https://nuxt.com/) (SSR disabled — this is a client-only app)
- Vue 3
- Dexie (IndexedDB wrapper) for persistence
- Tailwind CSS v4 + DaisyUI for styling
- Vitest for unit tests

## Setup

Install dependencies:

```bash
yarn install
```

## Development

Start the dev server at `http://localhost:3000`:

```bash
yarn dev
```

## Production

Build for production:

```bash
yarn build
```

Or generate a static site:

```bash
yarn generate
```

Preview a production build:

```bash
yarn preview
```

## Testing

Run the unit test suite (Vitest):

```bash
yarn test           # run once
yarn test:watch     # watch mode
yarn test:coverage   # with coverage report
```

Playwright is also installed for local end-to-end testing.

## Architecture

See [`CLAUDE.md`](./CLAUDE.md) for details on the data layer (Dexie schema), reactivity helpers, and key game logic (stashing, banking, farkle penalties, and turn advancement).
