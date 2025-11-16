# Verifica Domini Autorizzati Firebase

## Problema Risolto
✅ Le regole Firestore sono state create e deployate

## Prossimo Step: Verifica Domini Autorizzati

1. Vai su: https://console.firebase.google.com/project/gvnapp-e3e7d/authentication/settings

2. Nella sezione **Authorized domains**, verifica che siano presenti:
   - `localhost` (per sviluppo locale)
   - `gvnapp-e3e7d.web.app` (dominio Firebase Hosting)
   - `gvnapp-e3e7d.firebaseapp.com` (dominio alternativo)

3. Se mancano, clicca su **Add domain** e aggiungili.

## Test del Login

Ora prova a:
1. Svuotare la cache del browser (Ctrl+Shift+Delete)
2. Ricaricare la pagina
3. Aprire la Console del browser (F12)
4. Tentare il login e verificare eventuali errori nella console

## Errori Comuni da Cercare nella Console

- `permission-denied` → Le regole Firestore bloccavano (ora risolto)
- `auth/unauthorized-domain` → Aggiungi il dominio nei "Authorized domains"
- `auth/popup-blocked` → Il browser blocca il popup
- Errori di rete → Verifica la connessione

## Se Persiste il Problema

Condividi:
1. URL da cui stai tentando il login (localhost:5173 o gvnapp-e3e7d.web.app)
2. Screenshot della console JavaScript (F12) durante il tentativo di login
3. Qualsiasi messaggio di errore rosso che appare
