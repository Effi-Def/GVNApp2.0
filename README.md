# GVNApp 2.0 - Progressive Web App per Eventi Sociali

GVNApp è una Progressive Web App (PWA) progettata per fungere da hub centrale per un gruppo di amici. L'applicazione semplifica l'organizzazione di eventi sociali, la gestione delle spese di gruppo e la comunicazione.

## 🎯 Caratteristiche Principali

- **📅 Gestione Eventi**: Crea, modifica e gestisci eventi con sondaggi di partecipazione integrati
- **💰 Gestione Spese**: Divisione automatica dei costi con calcolo dei bilanci
- **📊 Sondaggi**: Creazione di sondaggi rapidi per decisioni di gruppo
- **📋 Liste Collaborative**: Liste della spesa e checklist condivise
- **🔔 Notifiche Push**: Aggiornamenti in tempo reale per eventi e attività
- **📱 PWA**: Installabile su dispositivi mobili, funziona offline

## 🛠️ Stack Tecnologico

### Frontend
- **React 18** con **TypeScript** per una UI robusta e type-safe
- **Vite** come build tool per sviluppo rapido
- **Tailwind CSS** per styling rapido e consistente
- **Zustand** per gestione dello stato leggera
- **React Router** per navigazione SPA

### Backend & Database
- **Firebase Auth** per autenticazione con provider sociali
- **Firestore** database NoSQL in tempo reale
- **Firebase Storage** per gestione file
- **Firebase Functions** per logiche serverless

### PWA
- **vite-plugin-pwa** per service worker e manifest
- **Workbox** per strategie di caching

## 🚀 Setup del Progetto

### Prerequisiti
- Node.js 20.19.0+ o 22.12.0+
- npm o yarn

### Installazione

1. Clona il repository:
\`\`\`bash
git clone <repository-url>
cd GVNApp2.0
\`\`\`

2. Installa le dipendenze:
\`\`\`bash
npm install
\`\`\`

3. Configura Firebase:
   - Crea un progetto Firebase su [console.firebase.google.com](https://console.firebase.google.com)
   - Abilita **Authentication** (provider Google), **Firestore**, e **Storage**
   - Copia \`.env.example\` in \`.env.local\`
   - Sostituisci i valori placeholder con la tua configurazione Firebase reale
   - Le credenziali si trovano in Project Settings > General > Your apps

4. Avvia il server di sviluppo:
\`\`\`bash
npm run dev
\`\`\`

## 📁 Struttura del Progetto

\`\`\`
src/
├── components/          # Componenti riutilizzabili
│   └── Layout/         # Componenti di layout (Navbar, BottomNav)
├── contexts/           # React contexts (Auth)
├── firebase/           # Configurazione Firebase
├── pages/             # Pagine principali dell'app
├── stores/            # Stores Zustand per gestione stato
├── types/             # Definizioni TypeScript
├── App.tsx            # Componente principale
├── main.tsx           # Entry point
└── index.css          # Stili globali
\`\`\`

## 🔧 Comandi Disponibili

- \`npm run dev\` - Avvia il server di sviluppo
- \`npm run build\` - Build per produzione
- \`npm run preview\` - Preview della build di produzione
- \`npm run lint\` - Controllo linting

## 🌟 Funzionalità Implementate

### ✅ Struttura Base
- [x] Setup Vite + React + TypeScript
- [x] Configurazione Tailwind CSS
- [x] Setup PWA con vite-plugin-pwa
- [x] Configurazione Firebase
- [x] Routing con React Router
- [x] Layout responsive con navigazione desktop/mobile

### ✅ Autenticazione
- [x] Context per autenticazione Firebase
- [x] Login con Google
- [x] Gestione stato utente con Zustand
- [x] Pagina di login

### ✅ Pagine Principali
- [x] Dashboard home con riepilogo
- [x] Struttura pagine Eventi, Spese, Sondaggi, Liste
- [x] Layout responsive

### ✅ Eventi
- [x] Creazione eventi con 8 categorie (cena, aperitivo, viaggio, sport, festa, cinema, shopping, altro)
- [x] Gestione date speciali per viaggi (data inizio e fine)
- [x] Sistema di partecipazione con stati: Sì, No, Forse
- [x] Auto-partecipazione del creatore dell'evento
- [x] Eliminazione a cascata (eventi + spese + sondaggi collegati)
- [x] Dashboard con statistiche eventi

### 🚧 In Sviluppo
- [ ] Sistema gestione spese completo
- [ ] Creazione e votazione sondaggi
- [ ] Liste collaborative
- [ ] Notifiche push
- [ ] Sincronizzazione Firestore avanzata

## 🎨 Design System

L'app utilizza un design system basato su Tailwind CSS con:
- **Colori primari**: Scala di blu (primary-50 to primary-900)
- **Typography**: Font system native
- **Responsive**: Mobile-first con breakpoints standard
- **Accessibilità**: Contrasti conformi WCAG

## 🔐 Sicurezza

- Autenticazione Firebase con provider sociali
- Rules Firestore per controllo accessi
- Validazione TypeScript per type safety
- Sanitizzazione input utente

## 📱 PWA Features

- **Installabile**: Aggiungibile alla home screen
- **Offline**: Funzionalità base disponibili offline
- **Responsive**: Ottimizzata per tutti i dispositivi
- **Performance**: Caricamento rapido con caching intelligente

## 🤝 Contribuire

1. Fork del progetto
2. Crea un branch per la feature (\`git checkout -b feature/AmazingFeature\`)
3. Commit delle modifiche (\`git commit -m 'Add some AmazingFeature'\`)
4. Push al branch (\`git push origin feature/AmazingFeature\`)
5. Apri una Pull Request

## 📄 Licenza

Questo progetto è sotto licenza MIT. Vedi il file \`LICENSE\` per dettagli.

## 🔗 Link Utili

- [React Documentation](https://react.dev/)
- [Vite Guide](https://vitejs.dev/guide/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)

---

## implementazioni future: pagina con mappa della montagna per le stanze.
**GVNApp 2.0** - Semplifica la vita sociale del tuo gruppo! 🎉
