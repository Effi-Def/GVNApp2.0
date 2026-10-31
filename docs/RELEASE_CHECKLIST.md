# Release Checklist - GVNApp

Versione: v1.0  
Ultimo aggiornamento: 2026-03-22

## 1. Pre-deploy
- [ ] Branch `main` aggiornata e PR approvata.
- [ ] Tutti i gate CI verdi (lint, test, build, e2e smoke).
- [ ] Verifica changelog aggiornato (`CHANGELOG.md`).
- [ ] Verifica variabili ambiente produzione (Firebase, VAPID, eventuale Sentry DSN).
- [ ] Verifica documenti legali pubblicati (`/legal/privacy`, `/legal/terms`).

## 2. Deploy
- [ ] Eseguire deploy web: `npm run deploy`.
- [ ] Se necessario, deploy functions: `npm run deploy:functions`.
- [ ] Annotare timestamp e release tag (`VITE_APP_RELEASE` o SHA) nel log di rilascio.

## 3. Smoke post-deploy
- [ ] Login Google funzionante da browser desktop.
- [ ] Creazione evento + RSVP + messaggio chat funzionanti.
- [ ] Creazione spesa su evento e vista saldi funzionanti.
- [ ] Apertura route legali da login e settings.
- [ ] Nessun errore critico in console o osservabilita` nei primi 10 minuti.

## 4. Rollback
- Trigger rollback immediato se:
  - errori bloccanti su login/navigation,
  - regressioni dati critiche,
  - spike errori runtime non mitigabile rapidamente.

Procedura rollback:
- [ ] Identificare ultima release stabile.
- [ ] Re-deploy della versione stabile (artifact/tag precedente).
- [ ] Verificare smoke post-rollback (login + eventi + spese).
- [ ] Annotare RCA preliminare e aprire issue correttiva.

## 5. Ownership
- Release approver: _da assegnare_
- Release executor: _da assegnare_
- Incident commander (fallback): _da assegnare_
