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

No test framework is configured yet (Vitest recommended when needed). No ESLint/Prettier configured.

## Architecture

SvelteKit 2 + Svelte 5 app with Tailwind CSS 4 + DaisyUI 5 and Supabase client.

**Routing:** File-based under `src/routes/`. `+layout.svelte` is the root layout, `+page.svelte` files are routes.

**Shared code:** `src/lib/` — importable via the `$lib` alias. `src/lib/index.ts` is the public re-export barrel. Organize into `lib/components/` (PascalCase `.svelte`) and `lib/utils/` (kebab-case `.ts`).

**Styles:** `src/app.css` imports Tailwind and DaisyUI via `@import "tailwindcss"` + `@plugin "daisyui"`. Tailwind is a Vite plugin (no config file needed).

**Runes mode:** Enforced globally for all user code via `svelte.config.js`. Always use `$state()`, `$derived()`, `$props()` — never the legacy Options API.

## Key Rules (from AGENTS.md)

**TypeScript:**
- `strict: true`, `verbatimModuleSyntax: true` — use `import type` for type-only imports
- Avoid `any`; prefer `unknown` with narrowing
- Annotate return types on exported functions
- No `.js` extensions needed in imports (`moduleResolution: "bundler"`)

**Svelte 5 patterns:**
```svelte
<script lang="ts">
  let count = $state(0);
  let doubled = $derived(count * 2);
  let { title }: { title: string } = $props();
</script>

{@render children()}  <!-- not <slot /> -->
```

**Naming:** `kebab-case.ts` for TS/JS files, `PascalCase.svelte` for components, `camelCase` for variables/functions, `PascalCase` for types, `SCREAMING_SNAKE_CASE` for constants.

**Formatting:** Tabs for indentation, single quotes in TS/JS, double quotes in HTML attributes, always include semicolons.

**Do not edit:** `.svelte-kit/` (auto-generated) or `package-lock.json`.
