# AGENTS.md — Coding Agent Guidelines

This file provides instructions for AI coding agents (and human contributors) working in this repository.

## Project Overview

- **Framework:** SvelteKit 2 (file-based routing, SSR-capable via `adapter-auto`)
- **UI layer:** Svelte 5 — runes mode enforced globally
- **Language:** TypeScript (strict) + JavaScript (checked via `checkJs`)
- **Build tool:** Vite 7 / **Package manager:** npm / **Target:** ESNext

---

## Commands

All commands are run from the `proj/` directory (where `package.json` lives).

```sh
npm install          # install dependencies
npm run dev          # start Vite dev server with HMR
npm run build        # production build
npm run preview      # serve the production build locally
npm run check        # type-check .svelte/.ts/.js via svelte-check  ← primary quality gate
npm run check:watch  # same, in watch mode
```

`npm run check` is the **only configured quality gate**. Always run it before committing.

### Tests — not yet configured

No test framework exists. The idiomatic SvelteKit choice is Vitest. When added, expected commands:

```sh
npx vitest run                          # all tests
npx vitest run src/lib/foo.test.ts      # single file
npx vitest run -t "test name pattern"   # by name
```

### Lint / Format — not yet configured

No ESLint, Prettier, or Biome config exists. Recommended additions: `eslint-plugin-svelte` +
`typescript-eslint` for linting; `prettier-plugin-svelte` for formatting. Update this file and
`package.json` scripts when added.

---

## TypeScript

**`tsconfig.json` key settings:**

- `"strict": true` — all strict flags on; no implicit `any`, strict null checks, etc.
- `"verbatimModuleSyntax": true` — type-only imports **must** use `import type { … }`
- `"isolatedModules": true` — each file must be independently compilable
- `"checkJs": true` — `.js` files are also type-checked
- `"moduleResolution": "bundler"` — Vite-compatible; no `.js` extension needed on local imports
- `"noEmit": true` — TypeScript is type-check only; Vite handles transpilation

**Rules:**

- Use `import type` for every type-only import (required by `verbatimModuleSyntax`).
- Avoid `any`; prefer `unknown` narrowed with type guards.
- Avoid non-null assertions (`!`); use optional chaining and explicit checks.
- Annotate return types explicitly on exported functions.
- Narrow `unknown` catch values before use: `e instanceof Error ? e.message : String(e)`

---

## Svelte 5 — Runes Mode

Runes mode is enforced for **all user code** in `svelte.config.js`. Legacy Svelte 4 APIs are unavailable.

| Svelte 4 (forbidden) | Svelte 5 runes (required) |
|---|---|
| `export let foo` | `let { foo } = $props()` |
| `$: derived = expr` | `let derived = $derived(expr)` |
| `let count = 0` (reactive) | `let count = $state(0)` |
| `<slot />` | `{@render children()}` |

**Component props pattern:**

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  interface Props { title: string; children?: Snippet; }
  let { title, children }: Props = $props();
</script>
```

- Always type `$props()` with an explicit interface.
- Prefer `$derived` over `$effect` for pure derivations — `$effect` is for side effects only.
- Always use `<script lang="ts">` in `.svelte` files.

---

## Imports and Modules

- **`$lib` alias** for everything under `src/lib/` — never traverse with relative `../../lib/…` paths.
- **ESM only** — `"type": "module"` in `package.json`; no `require()` or CommonJS.
- No file extension on local imports (bundler resolution): `import { foo } from '$lib/foo'`
- Keep `src/lib/index.ts` as a deliberate public re-export surface for the `$lib` API.
- In SvelteKit load functions, import `$app/*` and `@sveltejs/kit` helpers directly.

---

## File and Directory Conventions

**SvelteKit route files** use the `+` prefix (framework requirement):

- `+page.svelte` — page component
- `+layout.svelte` — layout wrapper
- `+page.ts` — universal load function (client + server)
- `+page.server.ts` — server-only load / form actions
- `+error.svelte` — error boundary

**Directory layout:**

```
src/
  app.html           # HTML shell
  app.d.ts           # Global TS declarations (App.Locals, App.PageData, etc.)
  lib/
    index.ts         # $lib public re-exports
    assets/          # Static assets imported by components
    components/      # Shared Svelte components (PascalCase.svelte)
    utils/           # Shared utility functions (kebab-case.ts)
  routes/            # File-based routes
static/              # Served as-is at root (robots.txt, etc.)
```

**Naming conventions:**

- Files: `kebab-case` for TS/JS modules; `PascalCase.svelte` for components
- Variables / functions: `camelCase`
- Types / interfaces / classes: `PascalCase`
- Module-level constants: `SCREAMING_SNAKE_CASE`

---

## Formatting

- **Indentation:** Tabs (consistent with all existing config files)
- **Quotes:** Single quotes in TS/JS; double quotes in HTML attributes
- **Semicolons:** Always include
- No automated formatter is active; match the style of surrounding code

---

## Error Handling

Use SvelteKit's `error()` helper in load functions:

```ts
import { error } from '@sveltejs/kit';
if (!item) throw error(404, 'Not found');
```

Prefer explicit errors over silent failures. Never ignore `unknown`-typed catch blocks.

---

## Do Not Edit

- `.svelte-kit/` — auto-generated on `dev`/`build`/`prepare`; changes will be overwritten
- `package-lock.json` — managed by npm exclusively
