# Security Remediation - 2026-03-21

## Scope
This remediation addresses immediate secret-management risks identified in the repository audit.

## Changes applied
- Removed local credential file `functions/serviceAccount.json` from the workspace.
- Added strict ignore patterns for credential artifacts in `.gitignore` and `functions/.gitignore`.
- Added a safe template file: `functions/serviceAccount.example.json`.
- Added CI guardrails:
  - `.github/workflows/ci.yml` for lint/build checks.
  - `.github/workflows/secret-scan.yml` for automated secret scanning.

## Mandatory follow-up outside Git
- Rotate/revoke any previously exposed Firebase service account keys in Google Cloud IAM.
- Audit Firebase and GCP logs for suspicious activity since key exposure.
- Force reauthentication where required by your security policy.

## Local usage policy
- Use `GOOGLE_APPLICATION_CREDENTIALS` pointing to an untracked local file.
- Never commit real service account credentials.
- Use `functions/serviceAccount.example.json` only as a structure reference.
