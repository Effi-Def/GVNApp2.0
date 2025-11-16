# GVNApp 2.0

Hub sociale del gruppo: organizza eventi, coordina liste e spese, chatta e ricevi promemoria — tutto in una PWA veloce, installabile e che funziona anche con rete ballerina.

Hosting: https://gvnapp-e3e7d.web.app

## 🎯 Scopo dell’app

Ridurre l’attrito dell’organizzazione fra amici. In pratica: fissare una data (“stasera si gioca?”), vedere chi c’è, gestire quote e cose da portare, e parlare al volo con una chat per evento. Il tutto con notifiche leggere e “umane”.

## � Funzionalità principali (oggi in produzione)

- Eventi
   - Creazione/modifica con categorie, luogo, orari, priorità (low/medium/high)
   - Multi‑day: selezione presenza per giorno
   - Partecipazione Sì/No/Forse; hint “Confermati/Forse” senza esporre nomi
   - Ordinamenti: per data, creato asc/desc, priorità
   - Condivisione pubblica: route pubblica `/share/e/:id` con pagina mini‑riassunto (senza auth)
- Chat per evento (v1)
   - Messaggi realtime, reazioni, modifica/cancella (finestra 15’), allegati (Storage) con limiti sicuri
   - Badge “Nuovi” nella lista eventi basato su `chatLastActivityAt` e tuo `lastReadByEvent`
   - Muto per singolo evento; ultimo letto per evento
   - Error‑handling in ascolto chat per evitare schermi bianchi
- Spese
   - Riepilogo saldi evento e “La tua situazione” (collassabili, chiusi di default)
   - Calcolo bilanci by payer/quote partecipanti
- Liste
   - Liste collaborative con nuovi generatori “Macchine” e “Stanze” con capienza (es. 5/2), driver, vincoli di unicità
- Sondaggi
   - Creazione sondaggi e collegamento ad evento con deep‑link nella notifica
- Notifiche
   - Push su mobile e notifiche desktop “leggere” (in‑app)
   - Preferenze granulari per tipologia (eventi, spese, sondaggi, liste, chat)
   - Test push da UI (Impostazioni → Notifiche → “Test push”)
   - Copy umani dalle Cloud Functions (“Stasera si gioca? 🎉”, “Vota anche tu 🗳️”, “Lista pronta 📝”, “Nuova spesa 💰 …”)
- UI/UX
   - Modali bottom‑sheet consistenti (safe‑area, scroll‑lock, action bar fissa, z‑index elevato)
   - Calendario con verdi più “leggibili”; azioni migliorate
   - Eliminati crash: sanitizzazione payload Firestore, gestione errori listener chat, normalizzazione date
- PWA
   - Service Worker Workbox + SW dedicato `firebase-messaging-sw.js` per push in background
   - Installabile, precache, offline di base

## 🧩 Architettura & stack

- Frontend: React 18 + TypeScript + Vite, Tailwind CSS, Zustand, React Router v6
- Firebase: Auth, Firestore, Storage, Functions (Node 20), Hosting
- PWA: vite‑plugin‑pwa, Workbox

## �️ Struttura (ridotta)

```
src/
   components/           # UI (Navbar, BottomNav, Chat, Calendario, …)
   pages/                # Home, Events, EventSummary, Expenses, Lists, Polls, PublicEvent, Settings, Notifications, NotificationPreferences
   services/             # Firestore services (event/expense/list/poll/chat/user)
   stores/               # Zustand (Auth, App, UserSettings, Notifications)
   firebase/             # config, messaging SW client
   types/                # tipi condivisi
```

## 🚀 Avvio rapido

1) Requisiti: Node 20+ e un progetto Firebase (Auth, Firestore, Storage, Functions)
2) Configura `.env.local` partendo da `.env.example` (incluso `VITE_FIREBASE_VAPID_KEY` per push)
3) Comandi principali:

```
npm install
npm run dev        # sviluppo
npm run build      # build produzione
npm run deploy     # build + deploy Hosting/Rules/Functions
```

### Se vedi avvisi sui placeholder senderId/appId

Se in console compare l’avviso “Skipping init: placeholder senderId/appId”, significa che nel file `.env.local` non hai ancora sostituito i valori di esempio:

- VITE_FIREBASE_MESSAGING_SENDER_ID deve essere l’ID numerico del mittente FCM del tuo progetto
- VITE_FIREBASE_APP_ID deve essere l’appId esatto della tua app Web

Dove trovarli:
- Vai su Firebase Console → Project settings (⚙️) → tab General → sezione “Your apps” → Web app → Config: copia `messagingSenderId` e `appId`
- Per le notifiche push, imposta anche `VITE_FIREBASE_VAPID_KEY` da Project settings → tab Cloud Messaging → Web push certificates → “Key pair”

Dopo aver aggiornato `.env.local`, riavvia il dev server o rifai la build.

## 🔔 Notifiche: come funzionano

- SW dedicato `public/firebase-messaging-sw.js` gestisce `push` e `notificationclick` (background)
- In app, `initMessaging()` chiede permesso e salva il token FCM nel documento utente (`users/{id}`)
- Le Cloud Functions inviano push solo se consentite e rispettando le preferenze per tipologia
- Pagina “Preferenze notifiche” (`/notifications/settings`) per attivare push/desktop e scegliere i tipi

## 🔐 Sicurezza & robustezza

- Sanitizzazione update verso Firestore (rimozione `undefined`, propagazione errori reali Firebase)
- Listener realtime con `onError` e banner UI per evitare schermate bianche
- (Da indurire ulteriormente) Regole Firestore per chat solo partecipanti

## 🧭 Roadmap (idee prossime)

- Notifiche chat più smart (menzioni, allegati), promemoria evento (N ore prima)
- Conteggio numerico “non letti” per chat nella lista eventi (oggi è badge booleano “Nuovi”)
- Regole Firestore più strette per chat e preferenze; pruning token FCM invalidi
- Migrazione `firebase-functions` all’ultima major (breaking changes) e metriche consegna
- Ottimizzazione bundle (code‑splitting manualChunks) per ridurre il chunk principale
- Pagina mappa/assegnazione stanze in stile “piantina”
- Modalità offline avanzata (draft queue, sync al ritorno rete)

## � Link utili

- React: https://react.dev
- Vite: https://vitejs.dev
- Tailwind: https://tailwindcss.com
- Firebase: https://firebase.google.com/docs
- Zustand: https://docs.pmnd.rs/zustand

—

GVNApp 2.0 — organizzare fra amici senza sbatti. 🎉
