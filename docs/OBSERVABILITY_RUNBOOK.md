# Observability e Incident Runbook - GVNApp

Versione: v1.0  
Ultimo aggiornamento: 2026-03-22

## 1. Obiettivo
Ridurre il tempo medio di diagnosi (MTTR) su errori frontend, push notifiche e accessi negati dalle regole.

## 2. Error tracking frontend
- Stack: `@sentry/react` con inizializzazione in `src/services/observability.ts`.
- Release tag: letto da `VITE_APP_RELEASE` / `VITE_GIT_SHA`, fallback `web-<mode>-<date>`.
- Fonti catturate:
  - React ErrorBoundary (`componentDidCatch`)
  - `window.error`
  - `window.unhandledrejection`

## 3. Alert operativi minimi (3)
- `ALERT-FE-ERROR-SPIKE`:
  - Trigger: aumento errori frontend (Sentry) oltre soglia definita dal team (es. > 20 errori/10m).
  - Azione: verificare release corrente e rollback se impatto elevato.

- `ALERT-FUNCTIONS-ERROR-RATE`:
  - Trigger: picco errori Cloud Functions (log severity error) su finestra 10 minuti.
  - Azione: aprire log su funzione impattata, mitigare regressione o disattivare flusso secondario.

- `ALERT-RULES-DENY-SPIKE`:
  - Trigger: incremento anomalo di `PERMISSION_DENIED` su Firestore.
  - Azione: validare ultime modifiche rules/deploy e verificare query client coinvolte.

## 4. Incident playbook rapido
- Login down:
  - Verifica stato Firebase Auth.
  - Controlla ultimi deploy frontend e configurazioni env.
  - Se regressione confermata, rollback deploy web.

- Push down:
  - Verifica token FCM validi e log Functions (`sendEachForMulticast`).
  - Controlla errori `messaging/*` e pulizia token invalidi.
  - Conferma permessi notifiche nel browser.

- Rules deny spike:
  - Isola collection/route impattata.
  - Confronta query app con regole correnti.
  - Applica fix rules o fallback client e ridistribuisci.

## 5. Game day rapido (table-top)
Eseguito il: 2026-03-22

Scenario simulato:
- Regressione frontend con eccezioni runtime su pagina eventi.

Passi eseguiti:
- Verifica presenza release tag e stack in error capture.
- Conferma percorso operativo: identificazione release, decisione rollback, verifica post-fix.

Esito:
- Runbook valido per diagnosi iniziale e triage operativo.
- Da completare in ambiente reale con alert effettivamente collegati ai canali on-call.
