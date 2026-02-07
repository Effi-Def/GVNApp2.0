# GVNApp 2.0

Hub sociale del gruppo: organizza eventi, coordina liste e spese, chatta e ricevi promemoria — tutto in una PWA veloce, installabile e che funziona anche con rete ballerina.

Hosting: https://gvnapp-e3e7d.web.app

## 🎯 Scopo dell’app

Ridurre l’attrito dell’organizzazione fra amici. In pratica: fissare una data (“stasera si gioca?”), vedere chi c’è, gestire quote e cose da portare, e parlare al volo con una chat per evento. Il tutto con notifiche leggere e “umane”.

## ✅ Funzionalità principali (oggi in produzione)

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

## 🗂️ Struttura (ridotta)

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

## 🔔 Notifiche: Guida all'attivazione

Per ricevere le notifiche push (messaggi, eventi, spese, ecc.) è necessario installare l'app come PWA. Ecco come fare:

### 🤖 Android
1. Apri **Chrome** e vai su `https://gvnapp-e3e7d.web.app`
2. Tocca il menu (tre puntini in alto a destra)
3. Seleziona **"Installa app"** o **"Aggiungi a schermata Home"**
4. Apri l'app appena installata dalla schermata Home
5. Al primo avvio (o andando in Impostazioni), accetta la richiesta di permessi per le notifiche

### 🍎 iOS (iPhone/iPad)
*Nota: Su iOS le notifiche web funzionano solo dalla versione 16.4 in poi e SOLO se l'app è aggiunta alla Home.*

1. Apri **Safari** (obbligatorio, altri browser potrebbero non funzionare)
2. Vai su `https://gvnapp-e3e7d.web.app`
3. Tocca il tasto **Condividi** (quadrato con freccia in basso al centro)
4. Scorri e seleziona **"Aggiungi alla schermata Home"**
5. Apri l'app "GVNApp" che è apparsa sulla tua Home
6. Vai in **Impostazioni** nell'app e assicurati che le notifiche siano attive. Quando richiesto da iOS, tocca **"Consenti"**

### ⚠️ Risoluzione problemi
Se non ricevi le notifiche:
1. Vai in **Impostazioni** nell'app
2. Clicca su **"Reset Service Worker ⚠️"**
3. Ricarica l'app
4. Clicca su **"Test push"** per verificare il funzionamento

## 🔔 Notifiche: come funzionano (Tecnico)

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

## 🧯 Bug backlog / Fix plan (work items)

> Serve per allineare riproduzione + file target + “done”.  
> Per procedere coi fix: condividi i file indicati (o conferma i path esatti nel repo).

### (1) Duplicazioni form
- **Sintomo:** lo stesso form esiste in più varianti/route/modal con logiche duplicate; bugfix non propagano.
- **Ipotesi:** componenti “-complete/-firebase” divergenti o state duplicato tra modal/page.
- **File target (probabili):** `src/components/**/**Form*.tsx`, `src/pages/**/*Form*.tsx`, `src/App.tsx` (routing), eventuali hook.
- **Done:** un solo componente sorgente (o wrapper) + props tipizzate; rimosse duplicazioni o consolidate.

### (2) Date miste (Timestamp/Date/string)
- **Sintomo:** sorting/filtri incoerenti; UI che mostra date “sballate” o crash su `.toDate()`.
- **Ipotesi:** conversione non centralizzata; write non normalizzati; campi opzionali non sanitizzati.
- **File target (obbligatorio):** `src/services/firestore.ts` (helper `toDate`/sanitizzazione), `src/types/index.ts`.
- **Done:** servizi convertono sempre in `Date` in lettura e scrivono `Timestamp` in scrittura; niente `undefined` verso Firestore.

### (3) Spese senza evento invisibili
- **Sintomo:** spese “globali”/senza `eventId` non compaiono in lista o non sono raggiungibili.
- **Ipotesi:** query filtra solo per `eventId`/route richiede sempre id evento; UI non gestisce `null`.
- **File target (probabili):** `src/services/firestore.ts` (expenseService query), `src/pages/Expenses*.tsx`, eventuale store spese.
- **Done:** una vista/section “Senza evento” oppure supporto esplicito a `eventId: null|undefined` con query dedicata.

### (4) iOS push incoerente
- **Sintomo:** permessi/subscribe instabili; token non salvato; notifiche arrivano “a volte”.
- **Ipotesi:** iOS richiede PWA installata + Safari; race tra SW registration e `getToken`; gestione errata di `Notification.permission`.
- **File target (probabili):** `src/firebase/messaging.ts`, `public/firebase-messaging-sw.js`, eventuale UI settings notifiche.
- **Done:** flow deterministico: registra SW → richiedi permesso (solo se installabile/standalone su iOS) → ottieni token → salva su `users/{id}`; retry + messaggi chiari.

### (5) `as any` nello store
- **Sintomo:** buchi di typing, possibili runtime error mascherati.
- **Ipotesi:** stato iniziale o setter non tipizzati; payload Firestore “unknown”.
- **File target (probabili):** `src/stores/*.ts`, `src/types/index.ts`.
- **Done:** eliminati `as any`; typing esplicito e narrowing su dati esterni.

### (6) Rounding importi (spese)
- **Sintomo:** centesimi “fantasma”/somma quote != totale; UI mostra 9.999999 o 10.000001.
- **Ipotesi:** uso di float senza normalizzazione; split quote senza arrotondamento coerente.
- **File target (probabili):** calcolo bilanci (page/service/util), tipi importo.
- **Done:** importi gestiti in **centesimi interi** o rounding centralizzato (es. `roundTo2` + invarianti); test su split e saldi.

### (7) Errore durante l’iscrizione ad un evento (RSVP / join)
- **Sintomo:** clic su “Partecipo / Forse / No” (o iscrizione) → errore e stato non salvato.
- **Da incollare qui (fondamentale):**
  - Messaggio completo in **console** (stacktrace) e eventuale `FirebaseError: ... (permission-denied|failed-precondition|invalid-argument|unauthenticated)`
  - Payload minimo: `eventId`, azione scelta (yes/no/maybe), se l’utente è loggato, e se l’evento è pubblico/condiviso.
- **Checklist debug veloce:**
  - Verifica `auth.currentUser` presente al click (niente sessione scaduta).
  - Se errore `permission-denied`: controlla **Firestore rules** su update di `events/{id}` (partecipanti / presence multi-day).
  - Se errore `invalid-argument`: probabile write con `undefined` o tipo data non valido → sanitizzazione nel service.
  - Se UI resta “ottimistica” ma poi rollback: gestire `catch` e mostrare errore + ripristino stato.
- **File target (probabili):**
  - `src/services/firestore.ts` (eventService: metodo RSVP/join/update partecipazione; sanitizzazione `undefined`; Timestamp/Date)
  - `src/pages/EventsPage-*.tsx` / `src/pages/EventSummary*.tsx` (handler click + UI error)
  - `firestore.rules` (permessi update campi partecipazione)
  - eventuale store eventi (`src/stores/*.ts`)
- **Done:** iscrizione affidabile (online), errore mostrato in modo chiaro, nessun write con `undefined`, regole allineate al modello dati.

## 🔗 Link utili

- React: https://react.dev
- Vite: https://vitejs.dev
- Tailwind: https://tailwindcss.com
- Firebase: https://firebase.google.com/docs
- Zustand: https://docs.pmnd.rs/zustand

—

GVNApp 2.0 — organizzare fra amici senza sbatti. 🎉
