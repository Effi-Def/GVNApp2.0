# GVNApp 2.0 - AI Coding Instructions

## Project Overview
GVNApp 2.0 is a **Progressive Web App (PWA)** built with **Vite, React, TypeScript**, and **Firebase**. It serves as a social events hub for organizing events, managing shared expenses, polls, and shopping lists.

## Architecture & Core Patterns

### 1. Service Layer Pattern (`src/services/firestore.ts`)
- **Centralized Logic:** All Firestore interactions are encapsulated in service objects (`eventService`, `expenseService`, etc.).
- **Data Transformation:** Services MUST handle conversion between Firestore `Timestamp` and JavaScript `Date` objects.
  - Use the `toDate` helper pattern seen in `getAll` methods to safely convert dates.
- **Undefined Handling:** Firestore rejects `undefined` values. Services MUST sanitize data (e.g., `cleanEventData`) before writing.
- **Optimistic Updates:** UI often updates via local state (Zustand) or re-fetching.

### 2. State Management (`src/stores/`)
- **Zustand:** Used for global state (`useAuthStore`, `AppStore`).
- **Auth Flow:** `useAuthStore.ts` manages Google Auth and triggers `loadUserData` to prefetch application data upon login.
- **Persistence:** User session is managed via Firebase Auth persistence.

### 3. Component Structure
- **Pages:** Located in `src/pages/`. Note the suffix convention (e.g., `EventsPage-complete.tsx`, `ExpensesPage-firebase.tsx`) which denotes specific implementation versions. `App.tsx` defines the active routes.
- **Layout:** `src/components/Layout/Layout.tsx` provides the shell (navigation, sidebar).
- **Modals/Forms:** Complex interactions (creating events, expenses) are often handled in modal components (e.g., `EventForm.tsx`, `ExpenseForm.tsx`).

### 4. Firebase Integration
- **Config:** `src/firebase/config.ts`.
- **Security:** Rules in `firestore.rules` and `storage.rules`.
- **Messaging:** `src/firebase/messaging.ts` and `public/firebase-messaging-sw.js` handle FCM.

## Critical Workflows

- **Development:** `npm run dev` (Starts Vite server).
- **Build:** `npm run build` (Runs `tsc` then `vite build`).
- **Deploy:** `npm run deploy` (Builds and deploys to Firebase Hosting).
- **Functions:** `npm run deploy:functions` (Deploys Cloud Functions).
- **Icons:** `npm run build:icons` (Generates PWA icons).

## Coding Conventions

- **Types:** Define shared interfaces in `src/types/index.ts`.
- **Styling:** **Tailwind CSS** is the standard. Use utility classes for layout and design.
- **Dates:** Always store as `Timestamp` in Firestore, work with `Date` objects in the app.
- **Imports:** Use relative imports.
- **PWA:** `vite.config.ts` handles PWA generation. **Disable SW in dev** to avoid caching issues (`disable: process.env.NODE_ENV === 'development'`).

## Key Files
- `src/App.tsx`: Main routing and auth check logic.
- `src/services/firestore.ts`: **CRITICAL**. Read this before modifying data access logic.
- `src/stores/useAuthStore.ts`: Auth state and data loading triggers.
- `vite.config.ts`: PWA and build configuration.
