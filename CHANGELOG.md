# Changelog

## [Non rilasciato]

### Added
- Scelta di chi ha pagato una spesa, anche diverso da chi la inserisce.
- Link a Spese, Sondaggi e Liste nel menu, anche su tablet.
- `functions/scripts/check-legacy-docs.cjs`: controllo in sola lettura dei documenti legacy.

### Changed
- Nomi coerenti in tutta l'app: Fattoria, Maiali e Re Maiale.
- Primo avvio un passo alla volta; il permesso notifiche viene chiesto dopo un tocco.
- Importi in formato italiano e un solo modulo per le spese.
- Modalita` di test disattivata nelle build di produzione (in CI si attiva con `VITE_E2E=1`).

### Fixed
- Quote e saldi delle spese sommano sempre al totale, anche su spese gia` salvate.
- Il pannello di debug non scrive piu` nel profilo utente in produzione.
- I profili non sono piu` elencabili e non contengono piu` l'email.
- Tema scuro, allineamento testi, menu tra 768 e 1023 px, titolo chat su desktop.
- Compilazione delle Cloud Functions.

### Notes
- Per entrare in funzione servono il deploy di hosting, regole e functions.
- Restano aperte le eccezioni legacy sui documenti senza `participantIds`.

## [0.1.0] - 2026-03-22

### Added
- Baseline test automation con Vitest (unit + coverage scope core).
- Smoke E2E con Playwright su journey critici (login/onboarding, evento/chat, spesa/saldi).
- CI quality gates estesi con lint, test, build, smoke E2E, artifact report e cache browser.
- Route legali pubbliche:
  - `/legal/privacy`
  - `/legal/terms`
- Documenti compliance minimi:
  - `docs/PRIVACY_POLICY.md`
  - `docs/TERMINI_DI_UTILIZZO.md`
- Observability frontend minima:
  - integrazione `@sentry/react`
  - cattura `ErrorBoundary`, `window.error`, `window.unhandledrejection`
  - tagging release da env (`VITE_APP_RELEASE` / `VITE_GIT_SHA`)
- Runbook operativo e alert base documentati in `docs/OBSERVABILITY_RUNBOOK.md`.

### Changed
- Hardening pipeline CI con `concurrency`, timeout job, report artifact persistenti.
- Link legali visibili da login e impostazioni.

### Notes
- Attivazione canali alert reali e branch protection required checks restano configurazioni lato piattaforma (GitHub/Firebase/Sentry).
