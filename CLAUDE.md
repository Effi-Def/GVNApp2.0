# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

GVNApp is a React + TypeScript + Firebase PWA where groups of friends organize events, expenses, polls, lists and chat. Production: https://gvnapp-e3e7d.web.app

## Commands

```bash
npm run dev                # Vite dev server (service worker disabled)
npm run build              # tsc --noEmit + vite build
npm run lint               # ESLint
npm run test:run           # all unit tests once (npm test = watch mode)
npm run test:e2e           # Playwright smoke tests (starts the dev server on port 4173)
npm run test:rules         # Firestore rules on the emulator (needs Java 21 on PATH)
cd functions && npm run build   # compile Cloud Functions into functions/lib (tracked in git)
```

Single test:

```bash
npx vitest run src/utils/ideas.test.ts
npx vitest run -t "sorts by interest"
npx playwright test e2e/smoke.spec.ts -g "crea idea"
```

CI (`.github/workflows/ci.yml`) runs lint, unit tests, build, E2E, rule tests and the Functions build. It has no `.env.local`: the build gets placeholder `VITE_FIREBASE_*` values plus `VITE_E2E=1`, so anything needed at build time must work with those.

Deploying: `npm run deploy` publishes everything in `firebase.json` (hosting, Functions, Firestore rules and indexes, Storage and RTDB rules). `npm run deploy:functions` publishes Functions only. Follow `docs/RELEASE_CHECKLIST.md`. Deploying affects real users, so do it only when asked.

## Architecture

- **Data access:** pages and stores import service objects from `src/services/firestore.ts`, a barrel over `src/services/firestore-modules/` (often split into `*-read.ts` and `*-write.ts`). Use `src/services/firestoreMappers.ts` to convert Timestamps to Dates on read (`toDate`, `toDateOrNow`) and to strip `undefined` on write (`cleanUndefinedDeep`), because Firestore rejects `undefined`.
- **State:** `AppStore` is a persisted Zustand cache of events, expenses, polls and lists. It is stale-while-revalidate: cached data renders first, then `loadUserData` / `refreshActiveFarmData` in `stores/useAuthStore.ts` replace it. Those loaders are also run on app resume (see `App.tsx`), and a page that writes only to its local state can show stale data after a remount.
- **Live data:** chat, channels, notifications and ideas use `onSnapshot` listeners instead of the cache. Ideas go through the `useFarmIdeas` hook.
- **Farm scoping:** data is scoped to the active farm (`useActiveFarmStore`, exposed through `contexts/FarmContext.tsx`). Polls, lists and expenses reach a farm through their `eventId`; only events carry farm tags (`visibility.farms`). Farm-level data without an event needs its own `farmId` or a `farms/{farmId}/...` path, otherwise the rules show it only to its creator.
- **Event model:** events keep three parallel structures that must stay consistent: `participants[]` (legacy), `participation` map (preferred) and `participantIds[]` (denormalized for security rules). Visibility and participation are separate concepts. Use the helpers in `utils/events.ts` (`userCanViewEvent`, `getUserEventParticipation`, `getSelectableEvents`) rather than reading the fields directly.
- **Security rules mirror the client:** `firestore.rules` enforces the same access logic server-side, so a new collection or field usually needs a rules change, and new query shapes may need `firestore.indexes.json`. `docs/firestore-rules.md` has background. Rule tests live in `tests/rules/`.
- **Cloud Functions:** everything is in `functions/src/index.ts`: Firestore triggers that send FCM and in-app notifications, plus `publicEvent` and `exportUserData`. A new collection holding user data must be added to `exportUserData`.
- **Routing and gates:** `App.tsx` holds the lazy routes, the auth gate with post-login redirect, the onboarding gate (no farms sends you to `/onboarding`) and the public `/share/e/:id` route.
- **PWA:** `vite.config.ts` generates `public/firebase-messaging-sw.js` from env vars at build start. It is git-ignored; do not edit it by hand.

## E2E mock runtime

`src/e2e/runtime.ts` replaces service methods with a mock database stored in localStorage. It is enabled by `gvn:e2e:enabled=1` (plus `gvn:e2e:scenario` and `gvn:e2e:auth`) and is active only in dev or with `VITE_E2E=1`, never in a production build.

- Only the patched methods are mocked. **Any service method missing from the runtime calls the real Firebase project configured in `.env.local`**, so add new service methods to the mock too.
- In `e2e/smoke.spec.ts`, `primeRuntime` clears localStorage on every page load, so `page.goto` wipes the mock data. Navigate with in-app links when a test must keep its data.

Unit tests only cover `src/**/*.test.ts` in a Node environment; there are no component tests.

## Conventions

- UI copy is in Italian. Use the farm theme everywhere in the interface: **Fattoria, Maiali, Re Maiale**, never Gruppo, Membri or Owner. Legal documents stay formal.
- Money: use `formatEuro`, `splitEqually` and `getExpenseShares` from `utils/expenseUtils.ts`, so shares always add up to the total.
- Theme: use the CSS tokens (`bg-[--bg-card]`, `text-[--text-base]`, `border-[--border-base]`) so dark mode works. Modals inside `space-y-*` parents need `!mt-0` on the `fixed` overlay.
- Shared types live in `src/types/index.ts`.
- User-entered links rendered as `href` must go through an http(s) check, as in `normalizeIdeaLink` in `utils/ideas.ts`.
- Commits use Conventional Commit prefixes with Italian descriptions (`fix: ...`, `feat: ...`). User-visible changes go under "Non rilasciato" in `CHANGELOG.md`.
- `# Implementazioni (priorità).txt` is the prioritized backlog.

## Outdated docs

`README.md` and `.github/copilot-instructions.md` predate recent changes. In particular, `firestore.ts` is no longer a single large file, and the page filename suffixes the Copilot file mentions no longer exist. Trust the code over them.
