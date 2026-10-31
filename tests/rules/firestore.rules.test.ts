import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const FARM = 'farm-1'
const OTHER_FARM = 'farm-2'
const OWNER = 'owner'
const AUTHOR = 'author'
const MEMBER = 'member'
const OUTSIDER = 'outsider'

let env: RulesTestEnvironment

const db = (uid: string) => env.authenticatedContext(uid).firestore()
const anonymous = () => env.unauthenticatedContext().firestore()

const ideaData = (overrides: Record<string, unknown> = {}) => ({
  farmId: FARM,
  title: 'Pesce a Sori',
  category: 'ristorante',
  createdBy: AUTHOR,
  interestedIds: [AUTHOR],
  status: 'open',
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  ...overrides,
})

const pollData = (overrides: Record<string, unknown> = {}) => ({
  title: 'Quando?',
  options: [{ id: 'a', text: 'Sabato', votes: 0 }],
  createdBy: AUTHOR,
  votes: [],
  isActive: true,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  ...overrides,
})

const vote = (userId: string) => ({ userId, userName: userId, optionId: 'a', votedAt: Timestamp.now() })

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gvnapp',
    firestore: { rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8') },
  })
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const admin = ctx.firestore()
    const joinedAt = Timestamp.fromDate(new Date('2030-01-01T00:00:00.000Z'))
    await setDoc(doc(admin, 'farms', FARM), { name: 'Fattoria', ownerId: OWNER })
    for (const [uid, role] of [[OWNER, 'owner'], [AUTHOR, 'member'], [MEMBER, 'member']]) {
      await setDoc(doc(admin, 'farms', FARM, 'members', uid), { role, accessLevel: 'full', joinedAt })
      await setDoc(doc(admin, 'userPrivate', uid), { farmIds: [FARM] })
    }
    await setDoc(doc(admin, 'farms', OTHER_FARM), { name: 'Altra', ownerId: OUTSIDER })
    await setDoc(doc(admin, 'farms', OTHER_FARM, 'members', OUTSIDER), { role: 'owner', accessLevel: 'full', joinedAt })
    await setDoc(doc(admin, 'userPrivate', OUTSIDER), { farmIds: [OTHER_FARM] })

    await setDoc(doc(admin, 'farms', FARM, 'ideas', 'idea-1'), ideaData())
    await setDoc(doc(admin, 'polls', 'farm-poll'), pollData({ farmId: FARM }))
    await setDoc(doc(admin, 'polls', 'personal-poll'), pollData())
    await setDoc(doc(admin, 'events', 'event-1'), {
      title: 'Cena',
      createdBy: AUTHOR,
      date: Timestamp.fromDate(new Date('2030-06-01T00:00:00.000Z')),
      visibility: { type: 'restricted', farms: [FARM] },
      participantIds: [AUTHOR, MEMBER],
      participation: {
        [AUTHOR]: { status: 'yes', accessLevel: 'full' },
        [MEMBER]: { status: 'yes', accessLevel: 'full' },
      },
    })
    await setDoc(doc(admin, 'polls', 'event-poll'), pollData({ eventId: 'event-1' }))
    await setDoc(doc(admin, 'users', MEMBER), { profile: { displayName: 'Maiale' } })
  })
})

describe('ideas: read', () => {
  it('lets farm members read and list', async () => {
    await assertSucceeds(getDoc(doc(db(MEMBER), 'farms', FARM, 'ideas', 'idea-1')))
    await assertSucceeds(getDocs(collection(db(MEMBER), 'farms', FARM, 'ideas')))
  })

  it('hides ideas from other farms and anonymous users', async () => {
    await assertFails(getDoc(doc(db(OUTSIDER), 'farms', FARM, 'ideas', 'idea-1')))
    await assertFails(getDocs(collection(db(OUTSIDER), 'farms', FARM, 'ideas')))
    await assertFails(getDoc(doc(anonymous(), 'farms', FARM, 'ideas', 'idea-1')))
  })
})

describe('ideas: create', () => {
  const create = (uid: string, data: Record<string, unknown>) =>
    setDoc(doc(db(uid), 'farms', FARM, 'ideas', 'new'), data)

  it('accepts a valid idea from a member', async () => {
    await assertSucceeds(create(MEMBER, ideaData({
      createdBy: MEMBER,
      interestedIds: [MEMBER],
      note: 'Fritto ottimo',
      link: 'https://www.esempio.it/menu',
      location: 'Sori',
    })))
  })

  it('refuses outsiders', async () => {
    await assertFails(create(OUTSIDER, ideaData({ createdBy: OUTSIDER, interestedIds: [OUTSIDER] })))
  })

  it('refuses an idea signed by someone else', async () => {
    await assertFails(create(MEMBER, ideaData({ createdBy: AUTHOR, interestedIds: [MEMBER] })))
  })

  it('refuses interest added on behalf of others', async () => {
    await assertFails(create(MEMBER, ideaData({ createdBy: MEMBER, interestedIds: [MEMBER, AUTHOR] })))
  })

  it('refuses an idea stored under the wrong farm', async () => {
    await assertFails(create(MEMBER, ideaData({ createdBy: MEMBER, interestedIds: [MEMBER], farmId: OTHER_FARM })))
  })

  it('refuses unsafe or malformed content', async () => {
    const base = { createdBy: MEMBER, interestedIds: [MEMBER] }
    await assertFails(create(MEMBER, ideaData({ ...base, link: 'javascript:alert(1)' })))
    await assertFails(create(MEMBER, ideaData({ ...base, title: '' })))
    await assertFails(create(MEMBER, ideaData({ ...base, title: 'x'.repeat(121) })))
    await assertFails(create(MEMBER, ideaData({ ...base, category: 'segreta' })))
    await assertFails(create(MEMBER, ideaData({ ...base, status: 'organized' })))
    await assertFails(create(MEMBER, ideaData({ ...base, extra: true })))
  })
})

describe('ideas: update', () => {
  const ref = (uid: string) => doc(db(uid), 'farms', FARM, 'ideas', 'idea-1')

  it('lets a member add and remove only their own interest', async () => {
    await assertSucceeds(updateDoc(ref(MEMBER), { interestedIds: arrayUnion(MEMBER), updatedAt: serverTimestamp() }))
    await assertSucceeds(updateDoc(ref(MEMBER), { interestedIds: arrayRemove(MEMBER), updatedAt: serverTimestamp() }))
  })

  it('refuses changing the interest of someone else', async () => {
    await assertFails(updateDoc(ref(MEMBER), { interestedIds: arrayRemove(AUTHOR) }))
    await assertFails(updateDoc(ref(MEMBER), { interestedIds: arrayUnion(OWNER) }))
    await assertFails(updateDoc(ref(MEMBER), { interestedIds: [MEMBER] }))
  })

  it('refuses outsiders', async () => {
    await assertFails(updateDoc(ref(OUTSIDER), { interestedIds: arrayUnion(OUTSIDER) }))
  })

  it('lets any member organize and reopen an idea', async () => {
    await assertSucceeds(updateDoc(ref(MEMBER), { status: 'organized', eventId: 'event-1', updatedAt: serverTimestamp() }))
    await assertSucceeds(updateDoc(ref(MEMBER), { status: 'open', eventId: deleteField(), updatedAt: serverTimestamp() }))
  })

  it('limits content changes to the author and the farm owner', async () => {
    await assertFails(updateDoc(ref(MEMBER), { title: 'Altro' }))
    await assertSucceeds(updateDoc(ref(AUTHOR), { title: 'Altro', note: deleteField() }))
    await assertSucceeds(updateDoc(ref(OWNER), { title: 'Altro ancora' }))
  })

  it('keeps identity fields immutable, even for the author', async () => {
    await assertFails(updateDoc(ref(AUTHOR), { createdBy: MEMBER }))
    await assertFails(updateDoc(ref(AUTHOR), { farmId: OTHER_FARM }))
  })
})

describe('ideas: delete', () => {
  const ref = (uid: string) => doc(db(uid), 'farms', FARM, 'ideas', 'idea-1')

  it('refuses other members', async () => {
    await assertFails(deleteDoc(ref(MEMBER)))
    await assertFails(deleteDoc(ref(OUTSIDER)))
  })

  it('allows the author', async () => {
    await assertSucceeds(deleteDoc(ref(AUTHOR)))
  })

  it('allows the farm owner', async () => {
    await assertSucceeds(deleteDoc(ref(OWNER)))
  })
})

describe('polls', () => {
  it('shows a farm poll to its members only', async () => {
    await assertSucceeds(getDoc(doc(db(MEMBER), 'polls', 'farm-poll')))
    await assertFails(getDoc(doc(db(OUTSIDER), 'polls', 'farm-poll')))
  })

  it('supports the farm query used to load polls', async () => {
    const byFarm = (uid: string, farmId: string) =>
      getDocs(query(collection(db(uid), 'polls'), where('farmId', '==', farmId)))
    await assertSucceeds(byFarm(MEMBER, FARM))
    await assertFails(byFarm(OUTSIDER, FARM))
  })

  it('keeps polls without farm and event visible to the creator only', async () => {
    await assertSucceeds(getDoc(doc(db(AUTHOR), 'polls', 'personal-poll')))
    await assertFails(getDoc(doc(db(MEMBER), 'polls', 'personal-poll')))
  })

  it('accepts a farm poll only from a member of that farm', async () => {
    await assertSucceeds(setDoc(doc(db(MEMBER), 'polls', 'new'), pollData({ createdBy: MEMBER, farmId: FARM })))
    await assertFails(setDoc(doc(db(OUTSIDER), 'polls', 'new-2'), pollData({ createdBy: OUTSIDER, farmId: FARM })))
  })

  it('lets a reader who is not the creator vote', async () => {
    await assertSucceeds(updateDoc(doc(db(MEMBER), 'polls', 'farm-poll'), { votes: arrayUnion(vote(MEMBER)), updatedAt: serverTimestamp() }))
    await assertSucceeds(updateDoc(doc(db(MEMBER), 'polls', 'event-poll'), { votes: arrayUnion(vote(MEMBER)), updatedAt: serverTimestamp() }))
  })

  it('refuses votes from outsiders or in the name of others', async () => {
    await assertFails(updateDoc(doc(db(OUTSIDER), 'polls', 'farm-poll'), { votes: arrayUnion(vote(OUTSIDER)) }))
    await assertFails(updateDoc(doc(db(MEMBER), 'polls', 'farm-poll'), { votes: arrayUnion(vote(OWNER)) }))
  })

  it('does not let a vote change or erase anything else', async () => {
    const ref = doc(db(MEMBER), 'polls', 'farm-poll')
    await assertFails(updateDoc(ref, { votes: arrayUnion(vote(MEMBER)), title: 'Altro' }))
    await assertFails(updateDoc(ref, { votes: [] }))
    await assertFails(updateDoc(ref, { isActive: false }))
  })

  it('leaves editing and deleting to the creator', async () => {
    await assertFails(deleteDoc(doc(db(MEMBER), 'polls', 'farm-poll')))
    await assertSucceeds(updateDoc(doc(db(AUTHOR), 'polls', 'farm-poll'), { title: 'Altro' }))
    await assertSucceeds(deleteDoc(doc(db(AUTHOR), 'polls', 'farm-poll')))
  })
})

describe('users', () => {
  it('allows reading a profile by id but not listing all users', async () => {
    await assertSucceeds(getDoc(doc(db(AUTHOR), 'users', MEMBER)))
    await assertFails(getDocs(collection(db(AUTHOR), 'users')))
    await assertFails(getDoc(doc(anonymous(), 'users', MEMBER)))
  })
})

describe('expenses', () => {
  const expense = (overrides: Record<string, unknown>) => ({
    title: 'Cena',
    amount: 10,
    eventId: 'event-1',
    participantIds: [AUTHOR, MEMBER],
    ...overrides,
  })

  it('lets a participant record a payment made by someone else', async () => {
    await assertSucceeds(setDoc(doc(db(MEMBER), 'expenses', 'e1'), expense({ paidBy: AUTHOR, createdBy: MEMBER })))
  })

  it('refuses a payment recorded by someone outside the event', async () => {
    await assertFails(setDoc(doc(db(OUTSIDER), 'expenses', 'e2'), expense({ paidBy: AUTHOR, createdBy: OUTSIDER })))
  })

  it('refuses an expense on a missing event', async () => {
    await assertFails(setDoc(doc(db(MEMBER), 'expenses', 'e3'), expense({ paidBy: MEMBER, createdBy: MEMBER, eventId: 'missing' })))
  })
})
