# Shared — @pedro/shared

Shared package used by both `@pedro/api` and `@pedro/mobile`.

## Stack
- **Language**: TypeScript
- **Validation**: Zod schemas

## Commands
```bash
pnpm build            # compile TypeScript
pnpm typecheck        # type check without emitting
pnpm dev              # watch mode for development
```

## Structure
```
src/
  index.ts              — barrel export
  constants/            — shared constants
  types/                — TypeScript type definitions
  validators/           — Zod validation schemas
```

## Key Rules
- This package is consumed by both API and mobile — changes here affect both.
- Always run `pnpm build` after changes so consumers pick up the new output in `dist/`.
- Keep this package dependency-light (currently only Zod).
- Export everything through `src/index.ts`.
