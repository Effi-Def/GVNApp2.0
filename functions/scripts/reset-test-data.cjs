/*
  DANGER: This script irreversibly deletes Firestore data and (optionally) Firebase Auth users.

  Usage (from repo root):
    cd functions
    npm install
    node scripts/reset-test-data.cjs --project YOUR_PROJECT_ID --yes

  Optional:
    --serviceAccount path/to/serviceAccount.json
    --auth               (also delete Firebase Auth users)
    --keepUid <uid>      (repeatable; keep these users when using --auth)
    --collections a,b,c  (override default collections)

  Notes:
  - Requires admin credentials. Easiest: set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON.
  - Always double-check the --project id.
*/

const fs = require('fs')
const path = require('path')

function parseArgs(argv) {
  const args = { keepUid: [] }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--yes') args.yes = true
    else if (a === '--auth') args.auth = true
    else if (a === '--project') args.project = argv[++i]
    else if (a.startsWith('--project=')) args.project = a.split('=')[1]
    else if (a === '--serviceAccount') args.serviceAccount = argv[++i]
    else if (a.startsWith('--serviceAccount=')) args.serviceAccount = a.split('=')[1]
    else if (a === '--keepUid') args.keepUid.push(argv[++i])
    else if (a.startsWith('--keepUid=')) args.keepUid.push(a.split('=')[1])
    else if (a === '--collections') args.collections = argv[++i]
    else if (a.startsWith('--collections=')) args.collections = a.split('=')[1]
    else {
      console.warn('Unknown arg:', a)
    }
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv)

  const projectId = (args.project || '').trim()
  if (!projectId) {
    console.error('Missing --project')
    process.exitCode = 1
    return
  }

  const defaultCollections = [
    // app domain
    'events',
    'expenses',
    'polls',
    'lists',
    'payments',

    // farms + invites + private metadata
    'farms',
    'farmInvites',
    'userPrivate',

    // user profiles (notifications are usually subcollections under users/{uid})
    'users',
  ]

  const collections = (args.collections ? String(args.collections) : defaultCollections.join(','))
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  console.log('============================================================')
  console.log('RESET TEST DATA (DESTRUCTIVE)')
  console.log('Project:', projectId)
  console.log('Firestore collections to delete (recursive):', collections.join(', '))
  console.log('Also delete Auth users:', !!args.auth)
  if (args.auth && args.keepUid.length) console.log('Keep UIDs:', args.keepUid.join(', '))
  console.log('============================================================')

  if (!args.yes) {
    console.error('Refusing to run without --yes')
    console.error('Example: node scripts/reset-test-data.cjs --project YOUR_PROJECT_ID --yes')
    process.exitCode = 2
    return
  }

  const admin = require('firebase-admin')

  const initOptions = { projectId }
  if (args.serviceAccount) {
    const p = path.resolve(process.cwd(), args.serviceAccount)
    if (!fs.existsSync(p)) {
      console.error('serviceAccount file not found:', p)
      process.exitCode = 3
      return
    }
    const svc = require(p)
    initOptions.credential = admin.credential.cert(svc)
  } else {
    // Uses GOOGLE_APPLICATION_CREDENTIALS when set.
    initOptions.credential = admin.credential.applicationDefault()
  }

  admin.initializeApp(initOptions)

  const db = admin.firestore()

  // Firestore recursive delete
  for (const col of collections) {
    console.log(`\nDeleting Firestore collection '${col}' (recursive)...`)
    try {
      await db.recursiveDelete(db.collection(col))
      console.log(`✅ Deleted '${col}'`)
    } catch (e) {
      console.error(`❌ Failed deleting '${col}':`, e)
      throw e
    }
  }

  if (args.auth) {
    const keep = new Set((args.keepUid || []).filter(Boolean))
    console.log('\nDeleting Firebase Auth users...')

    let pageToken = undefined
    let total = 0
    let deleted = 0

    do {
      const res = await admin.auth().listUsers(1000, pageToken)
      const uids = res.users
        .map(u => u.uid)
        .filter(uid => uid && !keep.has(uid))

      total += res.users.length

      // deleteUsers supports up to 1000 per call
      if (uids.length) {
        const delRes = await admin.auth().deleteUsers(uids)
        deleted += delRes.successCount
        if (delRes.failureCount > 0) {
          console.warn('Some user deletions failed:', delRes.errors.slice(0, 5))
        }
      }

      pageToken = res.pageToken
      process.stdout.write('.')
    } while (pageToken)

    console.log(`\n✅ Auth users listed: ${total}, deleted: ${deleted}, kept: ${keep.size}`)
  }

  console.log('\nDONE.')
}

main().catch((e) => {
  console.error('\nFATAL:', e)
  process.exitCode = 1
})
