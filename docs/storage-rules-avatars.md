# Firebase Storage rules example for avatars

Recommended rules to allow users to upload their own avatars under avatars/<uid>/:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /avatars/{uid}/{allPaths=**} {
      allow read: if true; // or restrict to auth if preferred
      allow write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Adjust read access as needed. Enforce content type and size if required.