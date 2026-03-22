# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server with HMR
npm run build        # Production build
npm run preview      # Preview production build
npm run check        # Type-check (primary quality gate — run before considering work done)
npm run check:watch  # Type-check in watch mode
```

No test framework or linter is configured yet.

## What this app does

A chess opening explorer. The user enters a username, selects a platform (Lichess or Chess.com) and color (white/black), and the app fetches their games, builds a move-frequency map keyed by position, and lets them step through lines to see which moves they play most often — along with win/draw/loss rates per move.

## Architecture

SvelteKit 2 + Svelte 5 (runes mode enforced globally). Tailwind CSS 4 + DaisyUI 5. No database — all state is in-memory per session.

**Data flow:**
1. `+page.svelte` calls a SvelteKit server route (`/api/games/lichess` or `/api/games/chess-com`) which proxies the external API server-side (avoids CORS, normalizes responses).
2. The server route returns `{ games: { moves: string, playerResult: 'win'|'draw'|'loss' }[] }`.
3. `buildMoveFrequencyMap()` in `src/lib/chess/move-tree.ts` replays every game with `chess.js`, recording which moves were played at each FEN position into two `MoveFrequencyMap`s — one for the player, one for the opponent.
4. `+page.svelte` holds `moveHistory: string[]` as the single source of truth. All board state (`fen`, `lastMovedSquares`, `sideToMove`) is `$derived.by` from it. The correct map (player vs opponent) is selected based on whose turn it is.

**Key files:**
- `src/lib/chess/move-tree.ts` — `Game`, `MoveFrequency`, `MoveFrequencyMap` types; `buildMoveFrequencyMap()` and `mergeFrequencyMaps()`.
- `src/routes/api/games/lichess/+server.ts` — proxies Lichess NDJSON API, filters by color, normalizes result.
- `src/routes/api/games/chess-com/+server.ts` — fetches monthly archives in parallel, parses PGNs (strips move numbers, clock annotations, variations), normalizes result.
- `src/lib/components/Board.svelte` — wraps chessground via a Svelte action (no `$effect`). The action's `update` callback handles prop changes; `latestBoardProps` handles the async import race.
- `src/lib/components/MoveList.svelte` — renders ranked moves with a frequency bar and a win/draw/loss bar.
- `src/routes/+page.ts` — `export const ssr = false` (page is fully client-side).

## Key rules

**TypeScript:** `strict: true`, `verbatimModuleSyntax: true` — use `import type` for type-only imports. Avoid `any`. Annotate return types on exported functions. No `.js` extensions in imports.

**Svelte 5:** Always use `$state()`, `$derived()`, `$derived.by()`, `$props()`. Never the legacy Options API or `<slot />`. Use `{@render children()}`. Minimize `$effect` — prefer Svelte actions or callbacks for imperative library integration.

**Naming:** `kebab-case.ts` for TS/JS files, `PascalCase.svelte` for components, `camelCase` for variables/functions, `PascalCase` for types. No abbreviations in variable names.

**Formatting:** Tabs for indentation, single quotes in TS/JS, double quotes in HTML attributes, always include semicolons. American English in UI text.

**Git workflow:** Branch per feature (`feat/...`, `fix/...`). Commit on the branch freely, but ask before pushing. Open a PR to merge into main — never commit directly to main.

**Do not edit:** `.svelte-kit/` (auto-generated) or `package-lock.json`.
