# Mobile — @pedro/mobile

React Native mobile app built with Expo and Expo Router.

## Stack
- **Framework**: Expo SDK 54 + Expo Router (file-based routing)
- **Language**: TypeScript
- **State**: Zustand or similar (check `src/store/`)
- **i18n**: Internationalization support (`src/i18n/`)
- **Storage**: expo-secure-store for sensitive data

## Commands
```bash
pnpm start            # start Expo dev server
pnpm android          # run on Android
pnpm ios              # run on iOS
pnpm web              # run on web
pnpm typecheck        # TypeScript check
```

## Structure
```
app/
  _layout.tsx           — root layout
  index.tsx             — entry screen
  (auth)/               — login/register screens
  (admin)/              — admin screens
  (dashboard)/          — main dashboard screens
src/
  components/           — reusable UI components
  hooks/                — custom React hooks
  i18n/                 — translations and locale config
  services/             — API client and service layer
  store/                — state management
  utils/                — helpers
assets/                 — images, fonts, etc.
```

## Key Patterns
- File-based routing via Expo Router — route groups `(auth)`, `(admin)`, `(dashboard)`.
- Uses `@pedro/shared` for validators, types, and constants.
- API communication through `src/services/`.
