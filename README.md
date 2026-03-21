# GVNApp 2.0

Hub sociale del gruppo: organizza eventi, coordina liste e spese, chatta e ricevi promemoria — tutto in una PWA veloce, installabile e che funziona anche con rete ballerina.

**Hosting:** https://gvnapp-e3e7d.web.app
**Ultimo aggiornamento README:** Marzo 2026

---

## 🎯 Scopo dell'app

Ridurre l'attrito dell'organizzazione fra amici. In pratica: fissare una data ("stasera si gioca?"), vedere chi c'è, gestire quote e cose da portare, e parlare al volo con una chat per evento. Il tutto con notifiche leggere e "umane".

---

## 🧩 Stack tecnologico

### Frontend
| Libreria | Versione | Ruolo |
|---|---|---|
| React | 18.2 | UI framework |
| TypeScript | 5.2 | Type safety |
| Vite | 5.0 | Build tool + dev server |
| Tailwind CSS | 3.3 | Styling utility-first |
| React Router | v6.20 | Client-side routing (lazy + Suspense) |
| Zustand | 4.4 | State management globale |
| React Hook Form | 7.66 | Form handling |
| Zod | 4.1 | Schema validation |
| Leaflet + react-leaflet | 1.9 / 4.x | Mappe OpenStreetMap (zero API key) |

### Firebase (SDK 10.7.1)
| Servizio | Uso |
|---|---|
| **Auth** | Google Sign-in, persistenza sessione |
| **Firestore** | Database principale (documenti + realtime listeners) |
| **Storage** | Allegati chat e spese (max 5 MB, jpg/png/webp) |
| **FCM** | Push notifications (multi-device via `fcmTokens[]`) |
| **Hosting** | Deploy statico PWA |
| **Functions** | Node 20, firebase-functions v5, firebase-admin v12 |

### PWA
- `vite-plugin-pwa` 0.17.4 + Workbox (`autoUpdate`, `skipWaiting`, `clientsClaim`)
- `firebase-messaging-sw.js` **auto-generato** da `vite.config.ts` tramite variabili `.env` — nessuna chiave hardcoded
- Manifest con icone 192/512/maskable/apple-touch
- SW disabilitato in `development` per evitare loop di caching

### Build & Bundle
- `manualChunks` per split stabile dei vendor:
  - `vendor-react` → react + react-dom + react-router-dom
  - `vendor-firebase-app`, `vendor-firebase-firestore`, `vendor-firebase-storage`, `vendor-firebase-messaging`
- Tutte le pagine sono **lazy-loaded** con `React.lazy` + `Suspense`
- Source maps disabilitati in produzione (abilitabili con `VITE_SOURCEMAP=true`)

---

## 🏗️ Architettura

### Service Layer (`src/services/`)
- `firestore.ts` (~1800 righe): tutti i servizi Firestore (`eventService`, `expenseService`, `pollService`, `listService`, `chatService`, `farmService`, `userService`, `paymentService`, `userPrivateService`)
- `firestoreMappers.ts`: helper centralizzati `toDate`, `toDateOrNow`, `toTimestamp`, `cleanUndefined`, `cleanUndefinedDeep` — conversione Timestamp ↔ Date e sanitizzazione `undefined` prima di ogni write
- `notifications.ts`: listener realtime delle notifiche in-app (`users/{uid}/notifications`)

### State Management (`src/stores/`)
| Store | Responsabilità |
|---|---|
| `useAuthStore` | Sessione Google Auth, `loadUserData()`, avatar cache prefetch |
| `AppStore` | Cache globale di eventi/spese/sondaggi/liste con **persist** Zustand + serializzazione Date personalizzata (`{ __date: ISO }`) |
| `useActiveFarmStore` | Farm attiva, lista farm, switch farm, persistenza `lastActiveFarmId` su localStorage + Firestore |
| `UserSettingsStore` | Profilo utente, preferenze notifiche, `lastReadByEvent`, FCM token(s) |
| `useNotificationsStore` | Notifiche in-app (realtime), badge contatore |

### Contesti
- `ActiveFarmProvider` (`src/contexts/FarmContext.tsx`): fornisce `activeFarmId` / `activeFarm` a tutti i componenti nel sotto-albero

### Pattern chiave
- **Stale-while-revalidate**: `AppStore` mostra dati persistiti istantaneamente, `loadUserData()` rimpiazza con freschi da Firestore
- **Resume refresh**: al ritorno in app (evento `visibilitychange` / `focus`) ricarica i dati con throttle di 15 s
- **Post-login redirect**: l'URL tentato prima del login è salvato in `sessionStorage` e ripristinato dopo l'autenticazione
- **Onboarding gate**: utenti senza farm vengono reindirizzati a `/onboarding`

---

## ✅ Funzionalità in produzione

### 🐷 Farms (gruppi)
- Creazione farm con nome, emoji, privacy (`invite` / `open`)
- Invito via link token (`/farms/join/:token`) — copia link con un tap
- Gestione membri: lista, kick, ruoli (`owner` / `member`)
- Gestione richieste join pendenti
- Multi-farm: switch rapido tra fattorie, `lastActiveFarmId` persistito
- Temi per farm (`default` / `cool` / `warm`)
- Onboarding dedicato per nuovi utenti senza farm

### 📅 Eventi
- CRUD completo con 8 categorie (cena, aperitivo, viaggio, sport, festa, cinema, shopping, altro)
- Priorità: `low` / `medium` / `high` — incide sull'ordinamento
- Lifecycle: `planning` → `scheduled` → `done` / `canceled`
- **Multi-day** (viaggi): `date` + `endDate`, presenza per singolo giorno (`days: Record<YYYY-MM-DD, boolean>`)
- **Date planning MVP**: `proposedDates[]` con voto per data (`dateVotes`) + finalizzazione
- Modello partecipazione doppio: nuovo `participation: Record<uid, EventParticipation>` + fallback legacy `participants[]`
- Visibilità: `public` / `restricted` (farm-scoped con `visibility.farms[]` o user-list)
- `participantIds[]` denormalizzato per le Firestore Security Rules
- **Mappa evento**: campo opzionale `locationGeo: { lat, lon, address }` — geocodifica via Nominatim (OpenStreetMap, nessuna API key); visualizzazione con Leaflet nel dettaglio evento; lazy-loaded nel chunk `vendor-leaflet`
- Ordinamenti: per data, creato asc/desc, priorità
- Paginazione (`PAGINATION_LIMIT = 20`) con caricamento progressivo
- **Condivisione pubblica**: route `/share/e/:id` senza auth; Cloud Function HTTPS `publicEvent` per i metadati
- `chatLastActivityAt` su ogni evento per badge "Nuovi" messaggi

### 💬 Chat per evento
- Messaggi realtime (`onSnapshot` su `events/{id}/messages`)
- Reazioni: `like` / `love` / `fun`
- Modifica e cancellazione entro 15 minuti
- Allegati: upload su Storage, tipi `image/video/file/audio`, progress bar
- Messaggi di sistema (`type: 'system'`) per spese/sondaggi/liste creati
- **Quote** messaggi (anteprima testo + miniatura media)
- **@mention**: `mentions[]` con routing notifica "chatMention"
- Badge booleano "Nuovi" basato su `lastReadByEvent` (per evento)
- Muto per singolo evento
- `ErrorBoundary` sul listener per evitare schermate bianche

### 💰 Spese
- CRUD con `title`, `amount`, `paidBy`, `participants[]`
- Tipi di divisione: `equal` / `custom` / `percentage`
- Allegati (scontrini/foto) e commenti inline
- Calcolo saldi: "La tua situazione" collassabile
- **`PaymentTransaction`**: registrazione pagamenti di saldo (scoped per farm o per evento)
- Pagina `FarmSettlementPage` (`/farm/settlement`): settlement cross-event con filtro smart per farm

### 📝 Liste
- Tipi: `shopping` / `todo` / `transport` / `lodging`
- Item con `status`, `dueDate`, `assignees[]`, `notes`
- **Trasporti (macchine)**: `capacity` posti, `driver`, vincolo unicità
- **Stanze**: `capacity` letti, vincolo unicità

### 🗳️ Sondaggi
- Creazione con opzioni multiple, scadenza (`votingEndsAt`), collegamento evento
- Deep-link nella notifica push

### 🔔 Notifiche
- **FCM multi-device**: `fcmTokens[]` per più dispositivi per utente; deduplication + pulizia automatica token invalidi
- **In-app persistenti**: salvataggio in `users/{uid}/notifications` (Firestore), realtime listener
- **Telegram bot** (canale alternativo): notifiche via `TELEGRAM_BOT_TOKEN` con bottone "Apri App 📱"
- Preferenze granulari per tipo: `event` / `expense` / `poll` / `list` / `chat`
- Muto per evento (no push chat per quell'evento)
- Permesso richiesto automaticamente al login (se `default`), skip silenzioso se `denied`
- Test push da UI: `sendTestPush` Cloud Function HTTPS callable
- Copy umani: "Stasera si gioca? 🎉", "Vota anche tu 🗳️", "Lista pronta 📝", "Nuova spesa 💰"

### ☁️ Cloud Functions (Node 20)
| Funzione | Trigger | Descrizione |
|---|---|---|
| `onEventCreated` | Firestore onCreate `events/{id}` | Notifiche ai partecipanti + tutti i member delle farm tagged; messaggi contestuali (oggi/domani/data) |
| `onExpenseCreated` | Firestore onCreate `expenses/{id}` | Notifiche a payer + partecipanti spesa |
| `onPollCreated` | Firestore onCreate `polls/{id}` | Notifiche ai partecipanti evento collegato |
| `onListCreated` | Firestore onCreate `lists/{id}` | Notifiche ai partecipanti evento collegato |
| `onChatMessageCreated` | Firestore onCreate `events/{eventId}/messages/{id}` | Push chat con rilevamento mention; skip messaggi di sistema |
| `publicEvent` | HTTPS GET | Restituisce metadati evento pubblico (no auth) |
| `sendTestPush` | HTTPS Callable | Test push end-to-end per l'utente chiamante |

### 📱 PWA & UX
- Service Worker `autoUpdate` (nessun prompt "Ricarica" su mobile)
- `firebase-messaging-sw.js` gestisce push in background con tag per-tipo/per-entità
- Installabile su Android (Chrome) e iOS 16.4+ (Safari)
- **Farm Media** (`/farm/media`): galleria di tutti gli allegati immagine delle chat degli eventi della farm, con lightbox + navigazione tastiera

---

## 🗂️ Struttura sorgenti

```
src/
  App.tsx               # routing lazy + auth gate + onboarding gate + resume refresh
  constants.ts          # categorie, APP_CONFIG (paginazione, limiti upload)
  components/           # UI atomici e composti
    Avatar/             # avatar utente con cache localStorage
    Calendar/           # vista calendario eventi
    Chat/               # componenti chat (messaggi, reazioni, allegati)
    Layout/             # shell app (Navbar, BottomNav, sidebar)
    ui/                 # primitivi (Button, Modal, Badge...)
    EventForm.tsx       # form creazione/modifica evento
    ExpenseForm.tsx     # form spesa con split
    QuickEventForm.tsx  # form rapido evento (inline nella lista)
    MvpEventCreateModal.tsx  # modal creazione evento da FarmDashboard
    ExpenseSettlement.tsx    # componente saldi e transazioni
    NotificationSystem.tsx   # toast in-app
  pages/
    HomePage.tsx              # dashboard farm: prossimo evento hero + attività recente
    FarmDashboardPage.tsx     # riepilogo farm: eventi, membri, quick-create
    FarmPage.tsx              # gestione farm: identità, admin, inviti, kick
    FarmSettlementPage.tsx    # saldi cross-event per farm
    FarmMediaPage.tsx         # galleria media chat
    FarmEventPage.tsx         # evento nel contesto farm
    JoinFarmPage.tsx          # join via token
    OnboardingPage.tsx        # primo accesso: crea o entra in una farm
    EventsPage.tsx            # lista eventi con RSVP inline
    EventSummary.tsx          # dettaglio evento (tab: info, chat, spese, liste, sondaggi)
    EventChatPage.tsx         # chat evento full-screen
    ExpensesPage.tsx          # lista spese globali
    PollsPage.tsx             # lista sondaggi
    ListsPage.tsx             # liste collaborative
    ChatsPage.tsx             # lista chat (tutte le farm)
    SettingsPage.tsx          # profilo, notifiche, farm, debug
    NotificationsPage.tsx     # inbox notifiche in-app
    NotificationPreferencesPage.tsx  # preferenze push/desktop per tipo
    PublicEvent.tsx           # pagina pubblica senza auth (/share/e/:id)
    LoginPage.tsx             # Google Sign-in
  services/
    firestore.ts          # tutti i service objects Firestore (~1800 righe)
    firestoreMappers.ts   # toDate / toTimestamp / cleanUndefinedDeep
    notifications.ts      # listener realtime notifiche in-app
  stores/
    useAuthStore.ts       # Google Auth + loadUserData
    AppStore.ts           # cache persist eventi/spese/liste/sondaggi
    useActiveFarmStore.ts # farm attiva + switch
    UserSettingsStore.ts  # profilo + notif settings + lastReadByEvent
    useNotificationsStore.ts  # badge + lista notifiche in-app
  types/index.ts          # interfacce condivise (Event, Expense, Poll, Farm...)
  utils/
    events.ts             # userCanViewEvent, getUserEventParticipation, getUserKeys
    avatarCache.ts        # prefetch e cache avatar condivisi
  firebase/
    config.ts             # inizializzazione Firebase
    messaging.ts          # initMessaging: permesso -> token -> salva su Firestore
    utils.ts              # checkFirebaseConfig (dev only)
  contexts/
    FarmContext.tsx        # ActiveFarmProvider (activeFarmId, activeFarm)
functions/src/index.ts    # Cloud Functions (7 handler)
firestore.rules           # Security Rules con membership farm e participantIds
storage.rules             # Security Rules Storage
vite.config.ts            # build config + PWA manifest + generateFcmSwPlugin
```

---

## 🔐 Sicurezza

- **Firestore Rules**: helper `userFarmIds()`, `isParticipant()`, `canViewFarmEvent()`, `canViewViaAnyFarm()` (loop unrolled per max 10 farm), `eventCutoffTime()` per visibilità temporale
- **Sanitizzazione write**: `cleanUndefinedDeep()` applicato su ogni write; nessun `undefined` raggiunge Firestore
- **Token FCM invalidi**: rimossi automaticamente dalla Cloud Function dopo un invio fallito
- **Public share**: i metadati evento esposti via HTTPS Function includono solo campi safe (no participantIds, ecc.)
- **Source maps**: disabilitati in produzione
- **Credenziali Admin**: non versionare mai `functions/serviceAccount.json`; usa `functions/serviceAccount.example.json` come template locale

---

## 🚀 Avvio rapido

**Requisiti:** Node 20+, progetto Firebase (Auth, Firestore, Storage, Functions)

```bash
npm install
cp .env.example .env.local   # compila con le tue credenziali Firebase
npm run dev                   # dev server (SW disabilitato)
npm run build                 # tsc --noEmit + vite build
npm run deploy                # build + deploy Hosting / Rules / Functions
npm run deploy:functions      # solo Cloud Functions
npm run build:icons           # rigenera icone PWA da scripts/generate-icons.mjs
```

### Variabili d'ambiente richieste (`.env.local`)

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=   # numerico, per FCM
VITE_FIREBASE_APP_ID=                # da Firebase Console -> Your apps
VITE_FIREBASE_VAPID_KEY=             # da Cloud Messaging -> Web push certificates
```

> Se vedi "Skipping init: placeholder senderId/appId" in console, significa che queste variabili non sono state impostate. Il `firebase-messaging-sw.js` viene **rigenerato** automaticamente da queste variabili a ogni `buildStart`.

---

## 🔔 Notifiche: guida all'attivazione

Per ricevere le notifiche push è necessario installare l'app come PWA.

### 🤖 Android
1. Apri **Chrome** → `https://gvnapp-e3e7d.web.app`
2. Menu → **"Installa app"** / **"Aggiungi a schermata Home"**
3. Apri l'app installata → al primo avvio accetta i permessi notifiche

### 🍎 iOS 16.4+ (iPhone/iPad)
1. Apri **Safari** (obbligatorio)
2. Vai su `https://gvnapp-e3e7d.web.app`
3. Tasto **Condividi** → **"Aggiungi alla schermata Home"**
4. Apri l'app dalla Home → Impostazioni → attiva notifiche → **"Consenti"**

### ⚠️ Troubleshooting
1. Impostazioni → **"Reset Service Worker ⚠️"** → ricarica
2. **"Test push"** per verificare il funzionamento end-to-end

### Come funzionano (tecnico)
- `firebase-messaging-sw.js` gestisce `push` + `notificationclick` in background con tag per-tipo/entità
- `initMessaging()` in `src/firebase/messaging.ts`: registra SW → richiede permesso → salva token in `users/{uid}.notifications.fcmTokens[]`
- Cloud Functions rispettano `pushEnabled` + preferenze per tipo (`types.chat`, `types.event`, ecc.)
- Canale alternativo: **Telegram bot** (configura `TELEGRAM_BOT_TOKEN` nelle Functions config)

---

## 🧭 Roadmap (idee prossime)

- Promemoria evento (push N ore prima)
- Conteggio numerico "non letti" per chat nella lista eventi (oggi: badge booleano)
- Regole Firestore più strette per chat (solo partecipanti)
- Migrazione a Firebase Functions v2 (gen2) per cold start ridotti
- Metriche consegna push (success rate, pruning automatico token stagni)
- Modalità offline avanzata (draft queue, sync al ritorno rete)
- Menzioni push smart (solo @me, non tutti)

---

## 🧯 Bug backlog / Fix plan

> Per procedere sui fix: condividi i file indicati o incolla lo stacktrace completo.

### (1) Duplicazioni form
- **Sintomo:** lo stesso form esiste in più varianti/route/modal con logiche duplicate; bugfix non propagano.
- **File target:** `src/components/**/*Form*.tsx`, `src/App.tsx` (routing)
- **Done:** un solo componente sorgente + props tipizzate; nessuna duplicazione.

### (2) Date miste (Timestamp/Date/string)
- **Sintomo:** sorting/filtri incoerenti; UI mostra date "sballate" o crash su `.toDate()`.
- **File target:** `src/services/firestoreMappers.ts`, `src/services/firestore.ts`, `src/types/index.ts`
- **Done:** `toDate` / `toTimestamp` applicati sistematicamente; nessun `undefined` verso Firestore.

### (3) Spese senza evento invisibili
- **Sintomo:** spese globali (`eventId` assente) non compaiono in lista.
- **File target:** `src/services/firestore.ts` (expenseService query), `src/pages/ExpensesPage.tsx`
- **Done:** sezione "Senza evento" oppure query dedicata per `eventId: null`.

### (4) iOS push incoerente
- **Sintomo:** permessi/subscribe instabili; token non salvato; notifiche arrivano "a volte".
- **File target:** `src/firebase/messaging.ts`, `public/firebase-messaging-sw.js`
- **Done:** flow deterministico SW → permesso → token → salva; retry + messaggi chiari.

### (5) `as any` nello store
- **Sintomo:** buchi di typing, possibili runtime error mascherati.
- **File target:** `src/stores/*.ts`, `src/types/index.ts`
- **Done:** eliminati `as any`; typing esplicito con narrowing.

### (6) Rounding importi (spese)
- **Sintomo:** centesimi "fantasma"; UI mostra 9.999999 o 10.000001.
- **File target:** calcolo bilanci in `ExpensesPage`, `ExpenseSettlement`, `firestore.ts`
- **Done:** rounding centralizzato `roundTo2` o importi in centesimi interi.

### (7) Errore RSVP / join evento
- **Sintomo:** clic su "Partecipo / Forse / No" → errore, stato non salvato.
- **Checklist debug:**
  - `auth.currentUser` presente? (sessione non scaduta)
  - `permission-denied` → verifica Firestore rules su `events/{id}` update
  - `invalid-argument` → write con `undefined` → `cleanUndefinedDeep` mancante
  - UI ottimistica poi rollback → gestire `catch` con ripristino stato
- **File target:** `src/services/firestore.ts` (eventService RSVP), `src/pages/EventsPage.tsx`, `src/pages/EventSummary.tsx`, `firestore.rules`
- **Done:** iscrizione affidabile, errore UI esplicito, nessun write con `undefined`.

---

## 🔗 Link utili

- React: https://react.dev
- Vite: https://vitejs.dev
- Tailwind: https://tailwindcss.com
- Firebase: https://firebase.google.com/docs
- Zustand: https://docs.pmnd.rs/zustand
- React Hook Form: https://react-hook-form.com
- Zod: https://zod.dev

---

GVNApp 2.0 — organizzare fra amici senza sbatti. 🎉