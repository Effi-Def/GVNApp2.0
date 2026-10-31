/*
  Read-only report: writes nothing to Firestore.

  Counts what must be clean before removing the legacy exceptions from the rules
  (`!('participantIds' in resource.data)` in firestore.rules and storage.rules)
  and shows how many profiles still hold the fields removed from the client.

  Usage (from repo root):
    cd functions
    node scripts/check-legacy-docs.cjs --project YOUR_PROJECT_ID

  Requires admin credentials: set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON.
*/

const admin = require('firebase-admin')

function getProject(argv) {
  const index = argv.indexOf('--project')
  if (index >= 0) return (argv[index + 1] || '').trim()
  const inline = argv.find(a => a.startsWith('--project='))
  return inline ? inline.split('=')[1].trim() : ''
}

async function main() {
  const projectId = getProject(process.argv)
  if (!projectId) {
    console.error('Missing --project')
    process.exitCode = 1
    return
  }

  admin.initializeApp({ projectId })
  const db = admin.firestore()

  for (const name of ['events', 'expenses']) {
    const snap = await db.collection(name).select('participantIds').get()
    const legacy = snap.docs.filter(d => !Array.isArray(d.get('participantIds')))
    console.log(`${name}: ${snap.size} total, ${legacy.length} without participantIds`)
    legacy.slice(0, 20).forEach(d => console.log(`  - ${d.id}`))
  }

  const users = await db.collection('users').select('email', 'test', 'timestamp').get()
  const withEmail = users.docs.filter(d => d.get('email') !== undefined).length
  const withTest = users.docs.filter(d => d.get('test') !== undefined || d.get('timestamp') !== undefined).length
  console.log(`users: ${users.size} total, ${withEmail} with e-mail in the profile, ${withTest} with test fields`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
