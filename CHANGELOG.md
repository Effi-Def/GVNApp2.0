# Changelog

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
