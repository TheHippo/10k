# Turn log as the source of truth (issues #4, #6, #7 foundation)

## Context

Three requested features all fail for the same reason:

- **#4 Undo** — revert an accidentally banked/farkled entry and re-enter it.
- **#6 Record progress per round** — show a clear breakdown of which scores happened in which round, in both the game view and history view.
- **#7 Sync between devices** — multiple devices enter scores into the same live game. *(Backend/auth are out of scope here; a Go backend comes later. This plan only builds the data foundation.)*

Today the authoritative state is **denormalized and mutable**: `gamePlayers.totalScore` / `consecutiveFarkles` and `game.currentGamePlayerId` are edited in place, while the `turns` log stores only a bare `{ pointsBanked, farkled }` and does **not** record the −1000 third-farkle penalty at all (it's folded straight into `totalScore`). Because past events aren't reconstructable from data, you can't undo, can't render a round-by-round breakdown, and can't ship a replayable event stream to other devices.

**The fix (already the user's instinct): make the `turns` log the authoritative event source, and derive everything else from it via one shared pure engine.** Undo becomes "drop the last event and recompute," the breakdown becomes "group the log by round," and future sync becomes "ship the log + replay it" — the same pure function a Go backend will mirror.

## Decisions locked in

- **#6 granularity:** per-round *turn totals* (each round shows every player's banked total / farkle / penalty + running total). No intra-turn stash logging. Works retroactively for finished games.
- **Turn IDs:** keep numeric `++id` auto-increment for now; UUIDs deferred until the backend lands.
- **State model:** turns are authoritative & append-only; `gamePlayers.totalScore` / `consecutiveFarkles` and `game.currentGamePlayerId` become a **projection rebuilt from the full log inside every write transaction**. Keeping these fields (rather than deriving on every read) means the existing `useLiveQuery` read sites and most tests stay intact, while there is still a single source of truth. All writes must go through the engine so the projection can never drift.
  - **Note:** `winnerGamePlayerId` is *not* part of this projection — it's a one-time decision made by `endGame()` (pick the highest standing at that moment), not re-derived by `rebuildProjection` on every turn.

## Approach

### 1. New pure engine — `app/game/engine.ts` (the heart of the change)

A single module, framework-free, split into a pure core (unit-testable, the future Go-parity spec) and thin db-mutation helpers.

**Pure core (no Dexie):**
```ts
deriveGameState(gamePlayers: GamePlayer[], turns: Turn[]): {
  standings: PlayerStanding[]      // per player: totalScore, consecutiveFarkles
  rounds: RoundBreakdown[]         // grouped for #6
  currentGamePlayerId: number
}
```
Iterate `turns` sorted by `turnNumber`, tracking each player's running total and consecutive-farkle count; apply `FARKLE_PENALTY` on every `MAX_CONSECUTIVE_FARKLES`-th farkle (resetting the streak). This reproduces exactly today's stored numbers, so it is backward-compatible with existing finished-game data. For each turn emit a derived record `{ turnNumber, round, gamePlayerId, farkled, pointsBanked, penalty, netPoints, runningTotal }`, where `round = Math.floor((turnNumber - 1) / numPlayers) + 1`. Current player = the `gamePlayer` whose `turnOrder === turns.length % numPlayers`.

**db-mutation helpers (wrap a transaction, then rebuild the projection):**
```ts
recordBank(gameId, gamePlayerId, points): append a non-farkle turn
recordFarkle(gameId, gamePlayerId):        append a farkled turn
undoLastTurn(gameId):                       delete the highest-turnNumber turn
rebuildProjection(gameId):                  deriveGameState → write totalScore /
                                            consecutiveFarkles / currentGamePlayerId back
```
Each mutation runs its write **and** `rebuildProjection` in one `db.transaction('rw', ...)`. This moves the bank/farkle/advance/penalty logic **out of `index.vue`** into one tested place. Note: because penalties are recomputed on replay (never stored), undoing a farkle that triggered −1000 rolls the penalty back automatically — no special-casing.

### 2. Schema — `app/db/index.ts`

Bump to `this.version(3)`. Add a compound index `[gameId+turnNumber]` on `turns` for ordered replay and last-turn lookup (keep `++id`, `gameId`, `gamePlayerId`):
```
turns: '++id, gameId, gamePlayerId, [gameId+turnNumber]'
```
Additive index only — Dexie backfills it, no data transform. Add a `.upgrade()` hook that calls `rebuildProjection` for every game once, guaranteeing stored projections match the engine's replay from day one.

### 3. Constants — `app/constants/game.ts`

Extract the magic numbers currently inline in `index.vue`:
```ts
export const FARKLE_PENALTY = -1000
export const MAX_CONSECUTIVE_FARKLES = 3
```

### 4. Types — `app/interfaces.ts`

Add derived (non-stored) types used by the engine and views: `PlayerStanding`, `TurnBreakdown`, `RoundBreakdown`. Stored `Turn` shape is unchanged (penalty stays derived, not persisted).

### 5. Game view — `app/pages/index.vue`

- Add a live query for the active game's turns (`activeTurns`, sorted by `turnNumber`) — the view currently never reads `db.turns`. Needed for both the round breakdown and the undo confirmation text below.
- Replace the inline `bank` / `farkle` / `advanceTurn` bodies with calls to `recordBank` / `recordFarkle`. Keep everything currently wrapping them exactly where it is — the ≥350/divisible-by-50 validation, `withHighScoreConfirm`, and the `refocusPointsInput()` calls after each action all stay in `index.vue`; only the DB transaction moves into the engine.
- **Undo (#4):** an Undo button (disabled when `activeTurns` is empty), opening a confirm `<dialog class="modal">` (reuse the `NewPlayerModal.vue` pattern) that names what will be reverted, e.g. "Undo Bob's Round 3 (+750)?" — built from the last entry in `activeTurns` plus `activeGamePlayers`. Confirms via `undoLastTurn`. Scope: the active game only (no undo affordance in history).
- **Breakdown (#6):** a per-round scoreboard rendered from `deriveGameState(activeGamePlayers, activeTurns).rounds`, placed below the standings table.

### 6. History view — `app/pages/history.vue`

Feed each finished game's `gamePlayers` + `turns` through `deriveGameState` and render the same per-round breakdown inside each game card (expandable via DaisyUI `collapse`). Existing winner/total display keeps working off the (now engine-maintained) projection fields.

### 6a. Shared component — `app/components/RoundBreakdown.vue`

Both index.vue and history.vue render the identical per-round table. Extract one presentational component, props `rounds: RoundBreakdown[]` + `players: GamePlayerWithName[]`, so the markup and formatting (FARKLE / −1000 styling) exist in exactly one place.

### 7. #7 groundwork only

No transport/backend in this plan. What lands here that makes sync a later add-on: (a) an append-only turn log as the single event stream, (b) a pure, side-effect-free `deriveGameState` that a Go backend can mirror for identical replay, (c) all writes funneled through the engine. The future sync work becomes "persist/stream turns remotely and call `rebuildProjection` on inbound events" — no rethinking of game logic.

## Files

- **New:** `app/game/engine.ts`, `app/components/RoundBreakdown.vue`
- **Edit:** `app/db/index.ts` (v3 + index + upgrade rebuild), `app/constants/game.ts`, `app/interfaces.ts`, `app/pages/index.vue`, `app/pages/history.vue`

## Testing / verification

- **New `tests/game/engine.spec.ts`** (pure, fast — the parity spec): replaying a turn sequence yields correct per-player totals; the 3rd consecutive farkle applies −1000 and resets the streak; current-player rotation incl. wrap-around; **undo** rolls back scores, farkle streak, penalty, and current player exactly; round grouping is correct for 2–6 players.
- **Update `tests/pages/index.turn-engine.spec.ts`** to the engine-backed flow (the existing bank/farkle/penalty/advance assertions should still hold against the same DB effects), and add: Undo disabled with no turns; Undo reverts the last bank; Undo reverts a penalty-triggering farkle; the per-round breakdown renders expected cells.
- **Playwright** (`yarn dev`, headless Chromium, following the existing scratchpad verify-script pattern): start a 2-player game, bank/farkle a few rounds, confirm the round breakdown matches, click Undo → confirm the last entry disappears and it's again that player's turn; check history view shows the per-round breakdown for a finished game.
- `yarn test` green; `npx nuxi typecheck` clean.
