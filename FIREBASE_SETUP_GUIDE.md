# Guida Setup Credenziali Firebase - GVNApp2.0

## 🚨 PROBLEMA ATTUALE
Il login Google non funziona perché le credenziali Firebase in `.env.local` sono placeholder (valori fittizi).

## ✅ SOLUZIONE: Ottieni le credenziali reali

### Step 1: Accedi alla Firebase Console
1. Vai su: https://console.firebase.google.com/
2. Seleziona il progetto **gvnapp-e3e7d**

### Step 2: Ottieni le credenziali dell'app Web

#### Opzione A: Da "Impostazioni Progetto"
1. Clicca sull'icona ingranaggio ⚙️ in alto a sinistra
2. Vai su **Impostazioni progetto**
3. Scorri in basso fino a "Le tue app"
4. Trova la tua app Web (o creane una se non esiste)
5. Clicca su **Configurazione** (icona `</>`)
6. Copia i valori mostrati in `firebaseConfig`:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",           // ← già corretto in .env.local
  authDomain: "gvnapp-e3e7d...", // ← già corretto
  projectId: "gvnapp-e3e7d",     // ← già corretto
  storageBucket: "gvnapp-e3e7d...", // ← già corretto
  messagingSenderId: "123456789012",  // ← QUESTO è quello reale (numero lungo)
  appId: "1:123456789012:web:abc123def456ghi789" // ← QUESTO è quello reale
};
```

#### Opzione B: Comando rapido
Se hai installato Firebase CLI:
```bash
firebase apps:sdkconfig web
```

### Step 3: Ottieni la VAPID Key per le notifiche Push

1. Sempre in Firebase Console > Impostazioni progetto
2. Vai alla tab **Cloud Messaging**
3. Scorri fino a **Configurazione Web**
4. Se non esiste, clicca su **Genera coppia di chiavi**
5. Copia la "Chiave pubblica Web Push (VAPID)"

### Step 4: Aggiorna .env.local

Apri il file `.env.local` nella root del progetto e sostituisci:

```env
# ❌ VECCHIO (placeholder)
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456

# ✅ NUOVO (valori reali dalla console)
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abc123def456ghi789

# Verifica anche che la VAPID key non sia placeholder:
VITE_FIREBASE_VAPID_KEY=BPjx... (la chiave reale che hai copiato, se diversa)
```

### Step 5: Riavvia il server di sviluppo

```bash
# Ferma il server (Ctrl+C)
# Poi riavvia:
npm run dev
```

### Step 6: Verifica il setup

1. Apri l'app in un browser
2. Vai alla pagina di login
3. Clicca su "Mostra diagnostica login" (in fondo)
4. Verifica che:
   - **Placeholder senderId**: ok (non ⚠️)
   - **Placeholder appId**: ok (non ⚠️)
   - **VAPID key**: present

### Step 7: Testa il login

1. Clicca su "Continua con Google"
2. Il popup dovrebbe aprirsi correttamente
3. Seleziona un account Google
4. Dovresti essere reindirizzato all'app autenticato

## 🔍 Verifica Connessioni Firebase

Per verificare che non ci siano inizializzazioni Firebase duplicate:

1. Apri la Console del browser (F12)
2. Nella console JavaScript digita:
```javascript
window.__gvn.firebase
```

Dovresti vedere:
```javascript
{
  appsCount: 1,           // ← deve essere 1, non 2 o più
  apps: [{...}],          // ← un solo oggetto nell'array
  active: {name: "[DEFAULT]", projectId: "gvnapp-e3e7d"}
}
```

Se `appsCount` è maggiore di 1, significa che c'è un'inizializzazione duplicata.

## 📱 Configurazione Domini Autorizzati

Se dopo aver aggiornato le credenziali vedi un errore `auth/unauthorized-domain`:

1. Vai su Firebase Console > Authentication
2. Clicca su tab **Settings**
3. Scorri a **Authorized domains**
4. Aggiungi:
   - `localhost` (per sviluppo)
   - Il tuo dominio di produzione (es. `gvnapp-e3e7d.web.app`)
   - Eventuali altri domini custom

## ✅ Checklist Completa

- [ ] Ottenute credenziali reali da Firebase Console
- [ ] Aggiornato VITE_FIREBASE_MESSAGING_SENDER_ID in .env.local
- [ ] Aggiornato VITE_FIREBASE_APP_ID in .env.local
- [ ] Verificata/aggiornata VITE_FIREBASE_VAPID_KEY
- [ ] Riavviato server di sviluppo
- [ ] Testato login Google (popup si apre)
- [ ] Verificato in console: window.__gvn.firebase.appsCount === 1
- [ ] Domini autorizzati configurati in Firebase Console

## 🆘 Se continua a non funzionare

1. **Svuota cache del browser** e ricarica (Ctrl+Shift+R)
2. **Reset completo**:
   - Nella diagnostica login clicca "Reset cache"
   - Oppure manualmente:
     - Apri DevTools (F12)
     - Application tab > Storage > Clear site data
3. **Verifica Service Worker**:
   - DevTools > Application > Service Workers
   - Clicca "Unregister" se ce n'è uno
   - Ricarica la pagina
4. **Controlla la console JavaScript** per errori specifici durante il tentativo di login

## 📞 Support

Se hai ancora problemi, condividi:
1. Screenshot della diagnostica login (in fondo alla pagina di login)
2. Errori dalla console JavaScript durante il tentativo di login
3. Output di `window.__gvn.firebase` dalla console
