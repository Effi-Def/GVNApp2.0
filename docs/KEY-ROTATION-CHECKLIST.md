# Key Rotation Checklist (Firebase/GCP)

Use this checklist if a service account key was ever exposed.

## 1) Revoke leaked key
1. Open Google Cloud Console.
2. Go to `IAM & Admin` -> `Service Accounts`.
3. Open the affected service account (for this project it was `firebase-adminsdk-*`).
4. Open tab `KEYS`.
5. Locate compromised key by `private_key_id`.
6. Click `Delete` key.

## 2) Create replacement key (only if strictly needed)
1. In the same service account -> `KEYS` -> `Add key` -> `Create new key`.
2. Choose `JSON`.
3. Download once and store only in secure local/secret manager storage.
4. Do NOT commit this file into git.

## 3) Update runtime credentials
- Local development:
1. Place credentials outside tracked paths, or in ignored local file.
2. Set `GOOGLE_APPLICATION_CREDENTIALS` to that file path.

- CI/CD:
1. Store credentials in GitHub Secrets or dedicated secret manager.
2. Inject secrets at runtime only.
3. Never echo secrets to logs.

## 4) Verify repository safety
1. Confirm `functions/serviceAccount.json` is absent.
2. Confirm ignore rules include `serviceAccount*.json`, `*.pem`, `*.p12`.
3. Run secret scan (`Secret Scan` GitHub Action).

## 5) Audit and incident checks
1. Open `Cloud Logging` and search for unusual API calls since potential exposure window.
2. Check Firebase Authentication, Firestore, and Functions activity anomalies.
3. If suspicious usage is found, rotate any additional related keys/tokens.

## 6) Prevent recurrence
1. Keep `.gitleaks.toml` in repository.
2. Enforce branch protection requiring CI + Secret Scan checks.
3. Keep service account templates only (`*.example.json`) and never real keys.
