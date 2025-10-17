# Firestore Security Rules per GVNApp

## Setup Iniziale (Modalità Test - Solo per Sviluppo)

Per permettere il testing durante lo sviluppo, usa queste regole in Firebase Console > Firestore Database > Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Modalità test - SOLO PER SVILUPPO
    // Cambiare prima di andare in produzione!
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

## Regole di Produzione (Da implementare successivamente)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - gli utenti possono leggere/scrivere solo i propri dati
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Events collection - solo utenti autenticati
    match /events/{eventId} {
      allow read, write: if request.auth != null;
    }
    
    // Expenses collection - solo utenti autenticati
    match /expenses/{expenseId} {
      allow read, write: if request.auth != null;
    }
    
    // Polls collection - solo utenti autenticati
    match /polls/{pollId} {
      allow read, write: if request.auth != null;
    }
    
    // Lists collection - solo utenti autenticati
    match /lists/{listId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Istruzioni

1. **Durante lo sviluppo**: Usa le regole in "Modalità Test"
2. **Prima del deployment**: Cambia alle regole di produzione
3. **Per testare**: Vai su Firebase Console > Firestore Database > Rules e incolla le regole appropriate

## Verifica delle Regole

Nel component FirebaseTroubleshooting viene testato se le regole permettono la scrittura.
Se vedi un errore "❌ DB Rules", controlla che le regole di Firestore siano configurate correttamente.
