import {
  chatService,
  eventService,
  expenseService,
  farmService,
  listService,
  paymentService,
  pollService,
  userPrivateService,
} from '../services/firestore'
import type {
  ChatMessage,
  ChatReactionKey,
  Event,
  EventParticipation,
  Expense,
  Farm,
  FarmMembership,
  PaymentTransaction,
  Poll,
  ShoppingList,
  User,
  UserPrivate,
} from '../types'

const ENABLED_KEY = 'gvn:e2e:enabled'
const SCENARIO_KEY = 'gvn:e2e:scenario'
const AUTH_KEY = 'gvn:e2e:auth'
const DB_KEY = 'gvn:e2e:db'

export const E2E_INVITE_TOKEN = 'pig-invite'
export const E2E_SEEDED_EVENT_ID = 'event-seeded'

type E2EScenario = 'new-user' | 'invite' | 'seeded'
type E2EAuthState = 'signed-in' | 'signed-out'

type InviteRecord = {
  farmId: string
  farmName?: string
  active: boolean
}

type ChatParticipantState = {
  uid: string
  lastReadAt?: Date
  displayName?: string
  photoUrl?: string
}

type TypingState = {
  uid: string
  updatedAt: Date
  typing: boolean
}

type MockDb = {
  scenario: E2EScenario
  users: Record<string, User>
  userPrivate: Record<string, UserPrivate>
  farms: Record<string, Farm>
  farmMembers: Record<string, FarmMembership[]>
  invites: Record<string, InviteRecord>
  events: Record<string, Event>
  expenses: Record<string, Expense>
  payments: Record<string, PaymentTransaction>
  polls: Record<string, Poll>
  lists: Record<string, ShoppingList>
  chats: Record<string, ChatMessage[]>
  chatParticipants: Record<string, ChatParticipantState[]>
  typing: Record<string, TypingState[]>
  counters: {
    farm: number
    event: number
    expense: number
    payment: number
    chat: number
  }
}

const CURRENT_USER_ID = 'user-smoke'
const OTHER_USER_ID = 'user-owner'
const SEEDED_FARM_ID = 'farm-smoke'

const CURRENT_USER: User = {
  id: CURRENT_USER_ID,
  email: 'smoke@gvn.test',
  displayName: 'Smoke Tester',
  createdAt: new Date('2030-01-10T09:00:00.000Z'),
}

const OTHER_USER: User = {
  id: OTHER_USER_ID,
  email: 'owner@gvn.test',
  displayName: 'Re Maiale',
  createdAt: new Date('2030-01-01T09:00:00.000Z'),
}

type MessageListener = (messages: ChatMessage[]) => void
type ParticipantListener = (participants: ChatParticipantState[]) => void
type TypingListener = (entries: TypingState[]) => void

const messageListeners = new Map<string, Set<MessageListener>>()
const participantListeners = new Map<string, Set<ParticipantListener>>()
const typingListeners = new Map<string, Set<TypingListener>>()

let installed = false

function hasWindow() {
  return typeof window !== 'undefined'
}

export function isE2EMode() {
  if (!hasWindow()) return false
  try {
    return window.localStorage.getItem(ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

export function getE2EScenario(): E2EScenario {
  if (!hasWindow()) return 'seeded'
  try {
    const raw = window.localStorage.getItem(SCENARIO_KEY)
    if (raw === 'new-user' || raw === 'invite' || raw === 'seeded') return raw
  } catch {}
  return 'seeded'
}

export function getE2EAuthState(): E2EAuthState {
  if (!hasWindow()) return 'signed-out'
  try {
    return window.localStorage.getItem(AUTH_KEY) === 'signed-in' ? 'signed-in' : 'signed-out'
  } catch {
    return 'signed-out'
  }
}

export function setE2EAuthState(next: E2EAuthState) {
  if (!hasWindow()) return
  try {
    window.localStorage.setItem(AUTH_KEY, next)
  } catch {}
}

export function getE2EUser(): User {
  ensureDb()
  return cloneValue(CURRENT_USER)
}

export function installE2ERuntime() {
  if (!isE2EMode()) return false
  ensureDb()
  if (installed) return true

  installed = true
  patchUserPrivateService()
  patchFarmService()
  patchEventService()
  patchExpenseService()
  patchPaymentService()
  patchPollAndListServices()
  patchChatService()

  try {
    ;(window as any).__gvnE2E = {
      scenario: getE2EScenario(),
      seededEventId: E2E_SEEDED_EVENT_ID,
      inviteToken: E2E_INVITE_TOKEN,
    }
  } catch {}

  return true
}

function encodeDates(value: unknown): unknown {
  if (value instanceof Date) {
    return { __date: value.toISOString() }
  }
  if (Array.isArray(value)) {
    return value.map((entry) => encodeDates(entry))
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, current] of Object.entries(value)) {
      out[key] = encodeDates(current)
    }
    return out
  }
  return value
}

function decodeDates(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => decodeDates(entry))
  }
  if (value && typeof value === 'object') {
    if ('__date' in value) {
      const raw = (value as { __date: string }).__date
      return new Date(raw)
    }
    const out: Record<string, unknown> = {}
    for (const [key, current] of Object.entries(value)) {
      out[key] = decodeDates(current)
    }
    return out
  }
  return value
}

function serializeValue<T>(value: T) {
  return JSON.stringify(encodeDates(value))
}

function cloneValue<T>(value: T): T {
  return decodeDates(JSON.parse(serializeValue(value))) as T
}

function readDb(): MockDb | null {
  if (!hasWindow()) return null
  try {
    const raw = window.localStorage.getItem(DB_KEY)
    if (!raw) return null
    return decodeDates(JSON.parse(raw)) as MockDb
  } catch {
    return null
  }
}

function writeDb(db: MockDb) {
  if (!hasWindow()) return
  try {
    window.localStorage.setItem(DB_KEY, serializeValue(db))
  } catch {}
}

function updateDb(mutator: (db: MockDb) => void) {
  const db = ensureDb()
  mutator(db)
  writeDb(db)
}

function ensureDb() {
  const scenario = getE2EScenario()
  const existing = readDb()
  if (existing && existing.scenario === scenario) {
    return existing
  }
  const seeded = createScenarioDb(scenario)
  writeDb(seeded)
  return seeded
}

function nextId(counter: keyof MockDb['counters'], prefix: string) {
  let value = ''
  updateDb((db) => {
    db.counters[counter] += 1
    value = `${prefix}-${db.counters[counter]}`
  })
  return value
}

function sortByNewest<T extends { createdAt?: Date; date?: Date }>(items: T[]) {
  return items.sort((left, right) => {
    const leftValue = left.createdAt?.getTime?.() ?? left.date?.getTime?.() ?? 0
    const rightValue = right.createdAt?.getTime?.() ?? right.date?.getTime?.() ?? 0
    return rightValue - leftValue
  })
}

function createScenarioDb(scenario: E2EScenario): MockDb {
  const now = new Date('2030-03-22T10:00:00.000Z')
  const farm: Farm = {
    id: SEEDED_FARM_ID,
    name: 'Smoke Farm',
    ownerId: OTHER_USER_ID,
    iconEmoji: '🐷',
    privacy: 'invite',
    inviteTokenId: E2E_INVITE_TOKEN,
    memberCount: 2,
    createdAt: now,
    updatedAt: now,
  }

  const ownerMembership: FarmMembership = {
    userId: OTHER_USER_ID,
    role: 'owner',
    accessLevel: 'full',
    joinedAt: new Date('2030-01-01T09:00:00.000Z'),
    displayName: OTHER_USER.displayName,
  }

  const currentMembership: FarmMembership = {
    userId: CURRENT_USER_ID,
    role: 'member',
    accessLevel: 'full',
    joinedAt: new Date('2030-02-01T09:00:00.000Z'),
    displayName: CURRENT_USER.displayName,
  }

  const seededEvent: Event = {
    id: E2E_SEEDED_EVENT_ID,
    title: 'Weekend in fattoria',
    description: 'Journey seed per RSVP, chat e spese.',
    category: 'cena',
    date: new Date('2030-06-15T19:30:00.000Z'),
    time: '19:30',
    location: 'Cascina Smoke',
    createdBy: OTHER_USER_ID,
    visibility: { type: 'restricted', farms: [SEEDED_FARM_ID] },
    participation: {
      [OTHER_USER_ID]: { status: 'yes', accessLevel: 'full', role: 'owner', respondedAt: now },
      [CURRENT_USER_ID]: { status: 'maybe', accessLevel: 'readonly', role: 'member', respondedAt: now },
    },
    participants: [
      { userId: OTHER_USER_ID, name: OTHER_USER.displayName, status: 'yes', respondedAt: now },
      { userId: CURRENT_USER_ID, name: CURRENT_USER.displayName, status: 'maybe', respondedAt: now },
    ],
    priority: 'medium',
    participantIds: [OTHER_USER_ID, CURRENT_USER_ID],
    createdAt: now,
    updatedAt: now,
  }

  const baseDb: MockDb = {
    scenario,
    users: {
      [CURRENT_USER_ID]: cloneValue(CURRENT_USER),
      [OTHER_USER_ID]: cloneValue(OTHER_USER),
    },
    userPrivate: {
      [CURRENT_USER_ID]: {
        id: CURRENT_USER_ID,
        farmIds: scenario === 'seeded' ? [SEEDED_FARM_ID] : [],
        farms: scenario === 'seeded'
          ? { [SEEDED_FARM_ID]: { role: 'member', joinedAt: currentMembership.joinedAt } }
          : {},
        lastActiveFarmId: scenario === 'seeded' ? SEEDED_FARM_ID : undefined,
        farmSettings: {},
        createdAt: CURRENT_USER.createdAt,
        updatedAt: now,
      },
      [OTHER_USER_ID]: {
        id: OTHER_USER_ID,
        farmIds: [SEEDED_FARM_ID],
        farms: { [SEEDED_FARM_ID]: { role: 'owner', joinedAt: ownerMembership.joinedAt } },
        lastActiveFarmId: SEEDED_FARM_ID,
        farmSettings: {},
        createdAt: OTHER_USER.createdAt,
        updatedAt: now,
      },
    },
    farms: scenario === 'new-user' ? {} : { [SEEDED_FARM_ID]: farm },
    farmMembers: scenario === 'seeded'
      ? { [SEEDED_FARM_ID]: [ownerMembership, currentMembership] }
      : scenario === 'invite'
        ? { [SEEDED_FARM_ID]: [ownerMembership] }
        : {},
    invites: scenario === 'new-user'
      ? {}
      : { [E2E_INVITE_TOKEN]: { farmId: SEEDED_FARM_ID, farmName: farm.name, active: true } },
    events: scenario === 'seeded' ? { [E2E_SEEDED_EVENT_ID]: seededEvent } : {},
    expenses: {},
    payments: {},
    polls: {},
    lists: {},
    chats: { [E2E_SEEDED_EVENT_ID]: [] },
    chatParticipants: {
      [E2E_SEEDED_EVENT_ID]: [
        { uid: OTHER_USER_ID, displayName: OTHER_USER.displayName },
        { uid: CURRENT_USER_ID, displayName: CURRENT_USER.displayName },
      ],
    },
    typing: { [E2E_SEEDED_EVENT_ID]: [] },
    counters: {
      farm: 1,
      event: 1,
      expense: 0,
      payment: 0,
      chat: 0,
    },
  }

  return baseDb
}

function getUserPrivate(userId: string) {
  const db = ensureDb()
  if (!db.userPrivate[userId]) {
    db.userPrivate[userId] = {
      id: userId,
      farmIds: [],
      farms: {},
      farmSettings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    writeDb(db)
  }
  return db.userPrivate[userId]
}

function cloneFarmMembers(farmId: string) {
  const db = ensureDb()
  return cloneValue(db.farmMembers[farmId] || [])
}

function notifyMessages(eventId: string) {
  const db = ensureDb()
  const listeners = messageListeners.get(eventId)
  if (!listeners) return
  const payload = cloneValue(sortByNewest([...(db.chats[eventId] || [])]).reverse())
  listeners.forEach((listener) => listener(payload))
}

function notifyParticipants(eventId: string) {
  const db = ensureDb()
  const listeners = participantListeners.get(eventId)
  if (!listeners) return
  const payload = cloneValue(db.chatParticipants[eventId] || [])
  listeners.forEach((listener) => listener(payload))
}

function notifyTyping(eventId: string) {
  const db = ensureDb()
  const listeners = typingListeners.get(eventId)
  if (!listeners) return
  const payload = cloneValue(db.typing[eventId] || [])
  listeners.forEach((listener) => listener(payload))
}

function registerListener<T>(
  registry: Map<string, Set<(payload: T) => void>>,
  key: string,
  listener: (payload: T) => void,
  initialValue: T,
) {
  if (!registry.has(key)) registry.set(key, new Set())
  registry.get(key)!.add(listener)
  listener(cloneValue(initialValue))
  return () => {
    registry.get(key)?.delete(listener)
  }
}

function patchUserPrivateService() {
  Object.assign(userPrivateService as object, {
    async getFarmIds(userId: string) {
      return cloneValue(getUserPrivate(userId).farmIds || [])
    },
    async getLastActiveFarmId(userId: string) {
      return getUserPrivate(userId).lastActiveFarmId || null
    },
    async setLastActiveFarmId(userId: string, farmId: string | null) {
      updateDb((db) => {
        const current = getUserPrivate(userId)
        current.lastActiveFarmId = farmId || undefined
        current.updatedAt = new Date()
        db.userPrivate[userId] = current
      })
    },
    async getFarmThemeKey(userId: string, farmId: string) {
      return getUserPrivate(userId).farmSettings?.[farmId]?.themeKey || null
    },
    async setFarmThemeKey(userId: string, farmId: string, themeKey: string) {
      updateDb((db) => {
        const current = getUserPrivate(userId)
        current.farmSettings = current.farmSettings || {}
        current.farmSettings[farmId] = { themeKey: themeKey as any }
        current.updatedAt = new Date()
        db.userPrivate[userId] = current
      })
    },
    async get(userId: string) {
      return cloneValue(getUserPrivate(userId))
    },
    async ensure(userId: string) {
      return cloneValue(getUserPrivate(userId))
    },
  })
}

function patchFarmService() {
  Object.assign(farmService as object, {
    async getMyFarms(userId: string) {
      const db = ensureDb()
      const farmIds = getUserPrivate(userId).farmIds || []
      return cloneValue(farmIds.map((farmId) => db.farms[farmId]).filter(Boolean))
    },
    async listMembers(farmId: string) {
      return cloneFarmMembers(farmId)
    },
    async getInvite(token: string) {
      const db = ensureDb()
      const invite = db.invites[token]
      return invite ? cloneValue(invite) : null
    },
    async createFarm(params: { name: string; ownerId: string; iconEmoji?: string; privacy?: Farm['privacy'] }) {
      const now = new Date()
      const farmId = nextId('farm', 'farm')
      const created: Farm = {
        id: farmId,
        name: params.name,
        ownerId: params.ownerId,
        iconEmoji: params.iconEmoji,
        privacy: params.privacy || 'invite',
        createdAt: now,
        updatedAt: now,
        memberCount: 1,
      }
      updateDb((db) => {
        db.farms[farmId] = created
        db.farmMembers[farmId] = [
          {
            userId: params.ownerId,
            role: 'owner',
            accessLevel: 'full',
            joinedAt: now,
            displayName: db.users[params.ownerId]?.displayName || 'Utente',
          },
        ]
        const current = getUserPrivate(params.ownerId)
        current.farmIds = Array.from(new Set([...(current.farmIds || []), farmId]))
        current.farms = current.farms || {}
        current.farms[farmId] = { role: 'owner', joinedAt: now }
        current.lastActiveFarmId = farmId
        current.updatedAt = now
        db.userPrivate[params.ownerId] = current
      })
      return cloneValue(created)
    },
    async joinDirectlyByToken(params: { token: string; user: { id: string; displayName?: string; photoURL?: string } }) {
      const db = ensureDb()
      const invite = db.invites[params.token]
      if (!invite || !invite.active) {
        throw new Error('Invito non valido o scaduto')
      }
      const now = new Date()
      updateDb((nextDb) => {
        const members = nextDb.farmMembers[invite.farmId] || []
        if (!members.some((member) => member.userId === params.user.id)) {
          members.push({
            userId: params.user.id,
            role: 'member',
            accessLevel: 'full',
            joinedAt: now,
            displayName: params.user.displayName || nextDb.users[params.user.id]?.displayName || 'Utente',
            photoURL: params.user.photoURL,
          })
        }
        nextDb.farmMembers[invite.farmId] = members
        const farm = nextDb.farms[invite.farmId]
        if (farm) {
          farm.memberCount = members.length
          farm.updatedAt = now
        }
        const current = getUserPrivate(params.user.id)
        current.farmIds = Array.from(new Set([...(current.farmIds || []), invite.farmId]))
        current.farms = current.farms || {}
        current.farms[invite.farmId] = { role: 'member', joinedAt: now }
        current.lastActiveFarmId = invite.farmId
        current.updatedAt = now
        nextDb.userPrivate[params.user.id] = current
      })
      return invite.farmId
    },
  })
}

function buildParticipation(status: 'yes' | 'maybe' | 'no'): EventParticipation {
  return {
    status,
    accessLevel: status === 'yes' ? 'full' : 'readonly',
    respondedAt: new Date(),
    role: 'member',
  }
}

function patchEventService() {
  Object.assign(eventService as object, {
    async getAll() {
      const db = ensureDb()
      return cloneValue(sortByNewest(Object.values(db.events)))
    },
    async getById(id: string) {
      const db = ensureDb()
      return db.events[id] ? cloneValue(db.events[id]) : null
    },
    async getMoreEvents() {
      return { events: [], lastDoc: null }
    },
    async create(eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>) {
      const now = new Date()
      const eventId = nextId('event', 'event')
      const created: Event = {
        ...cloneValue(eventData),
        id: eventId,
        participation: cloneValue(eventData.participation || {}),
        participantIds: Array.from(new Set(eventData.participantIds || eventData.participants.map((participant) => participant.userId))),
        createdAt: now,
        updatedAt: now,
      }
      updateDb((db) => {
        db.events[eventId] = created
      })
      return cloneValue(created)
    },
    async update(eventId: string, eventData: Partial<Event>) {
      updateDb((db) => {
        const current = db.events[eventId]
        if (!current) return
        db.events[eventId] = {
          ...current,
          ...cloneValue(eventData),
          updatedAt: new Date(),
        }
      })
    },
    async delete(eventId: string) {
      updateDb((db) => {
        delete db.events[eventId]
      })
    },
    async updateParticipation(eventId: string, userId: string, userName: string, status: 'yes' | 'no' | 'maybe') {
      updateDb((db) => {
        const event = db.events[eventId]
        if (!event) return
        const respondedAt = new Date()
        const participantIndex = event.participants.findIndex((participant) => participant.userId === userId)
        const nextParticipant = { userId, name: userName, status, respondedAt }
        if (participantIndex >= 0) {
          event.participants[participantIndex] = nextParticipant
        } else {
          event.participants.push(nextParticipant)
        }
        event.participation = event.participation || {}
        event.participation[userId] = buildParticipation(status)
        event.participantIds = Array.from(new Set([...(event.participantIds || []), userId]))
        event.updatedAt = respondedAt
      })
    },
  })
}

function patchExpenseService() {
  Object.assign(expenseService as object, {
    async getAll() {
      const db = ensureDb()
      return cloneValue(sortByNewest(Object.values(db.expenses)))
    },
    async getForEventIds(eventIds: string[]) {
      const db = ensureDb()
      return cloneValue(
        sortByNewest(Object.values(db.expenses).filter((expense) => !!expense.eventId && eventIds.includes(expense.eventId)))
      )
    },
    async create(expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) {
      const now = new Date()
      const expenseId = nextId('expense', 'expense')
      const created: Expense = {
        ...cloneValue(expenseData),
        id: expenseId,
        participantIds: Array.from(new Set(expenseData.participantIds || expenseData.participants.map((participant) => participant.userId))),
        createdAt: now,
        updatedAt: now,
      }
      updateDb((db) => {
        db.expenses[expenseId] = created
      })
      return cloneValue(created)
    },
    async update(expenseId: string, expenseData: Partial<Expense>) {
      updateDb((db) => {
        const current = db.expenses[expenseId]
        if (!current) return
        db.expenses[expenseId] = {
          ...current,
          ...cloneValue(expenseData),
          updatedAt: new Date(),
        }
      })
    },
    async delete(expenseId: string) {
      updateDb((db) => {
        delete db.expenses[expenseId]
      })
    },
  })
}

function patchPaymentService() {
  Object.assign(paymentService as object, {
    async getAll() {
      const db = ensureDb()
      return cloneValue(sortByNewest(Object.values(db.payments)))
    },
    async getForUser(userId: string) {
      const db = ensureDb()
      return cloneValue(
        sortByNewest(
          Object.values(db.payments).filter((payment) => payment.fromUserId === userId || payment.toUserId === userId)
        )
      )
    },
    async create(paymentData: Omit<PaymentTransaction, 'id' | 'createdAt'>) {
      const now = new Date()
      const paymentId = nextId('payment', 'payment')
      const created: PaymentTransaction = {
        ...cloneValue(paymentData),
        id: paymentId,
        createdAt: now,
      }
      updateDb((db) => {
        db.payments[paymentId] = created
      })
      return cloneValue(created)
    },
  })
}

function patchPollAndListServices() {
  Object.assign(pollService as object, {
    async getAll() {
      return []
    },
    async getForUserVisibleEvents() {
      return []
    },
  })

  Object.assign(listService as object, {
    async getAll() {
      return []
    },
    async getByEventId() {
      return []
    },
    async getForUserVisibleEvents() {
      return []
    },
  })
}

function patchChatService() {
  Object.assign(chatService as object, {
    listen(eventId: string, callback: MessageListener) {
      const db = ensureDb()
      return registerListener(messageListeners, eventId, callback, sortByNewest([...(db.chats[eventId] || [])]).reverse())
    },
    listenParticipants(eventId: string, callback: ParticipantListener) {
      const db = ensureDb()
      return registerListener(participantListeners, eventId, callback, db.chatParticipants[eventId] || [])
    },
    listenTyping(eventId: string, callback: TypingListener) {
      const db = ensureDb()
      return registerListener(typingListeners, eventId, callback, db.typing[eventId] || [])
    },
    async markRead(eventId: string, userId: string, meta?: { displayName?: string; photoURL?: string }) {
      updateDb((db) => {
        const participants = db.chatParticipants[eventId] || []
        const index = participants.findIndex((participant) => participant.uid === userId)
        const entry: ChatParticipantState = {
          uid: userId,
          lastReadAt: new Date(),
          displayName: meta?.displayName || db.users[userId]?.displayName,
          photoUrl: meta?.photoURL,
        }
        if (index >= 0) participants[index] = { ...participants[index], ...entry }
        else participants.push(entry)
        db.chatParticipants[eventId] = participants
      })
      notifyParticipants(eventId)
    },
    async sendMessage(
      eventId: string,
      payload: { text?: string; files?: File[]; quoted?: ChatMessage['quoted']; mentions?: string[] },
      actor: { id: string; displayName: string; photoURL?: string },
      onProgress?: (fileName: string, pct: number) => void,
    ) {
      const now = new Date()
      const messageId = nextId('chat', 'chat')
      const attachments = (payload.files || []).map((file) => {
        onProgress?.(file.name, 100)
        return {
          id: `${messageId}-${file.name}`,
          url: `e2e://${file.name}`,
          name: file.name,
          type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'file',
          size: file.size,
          contentType: file.type,
        } as const
      })
      const created: ChatMessage = {
        id: messageId,
        eventId,
        userId: actor.id,
        userName: actor.displayName,
        userPhotoURL: actor.photoURL,
        text: payload.text,
        mentions: payload.mentions,
        quoted: payload.quoted,
        attachments: attachments.length > 0 ? attachments : undefined,
        createdAt: now,
      }
      updateDb((db) => {
        const messages = db.chats[eventId] || []
        messages.push(created)
        db.chats[eventId] = messages
        const event = db.events[eventId]
        if (event) {
          event.chatLastActivityAt = now
          event.updatedAt = now
        }
      })
      await (chatService as any).markRead(eventId, actor.id, { displayName: actor.displayName, photoURL: actor.photoURL })
      notifyMessages(eventId)
    },
    async toggleReaction(eventId: string, messageId: string, key: ChatReactionKey, userId: string, remove: boolean) {
      updateDb((db) => {
        const message = (db.chats[eventId] || []).find((entry) => entry.id === messageId)
        if (!message) return
        message.reactions = message.reactions || {}
        const current = new Set(message.reactions[key] || [])
        if (remove) current.delete(userId)
        else current.add(userId)
        message.reactions[key] = Array.from(current)
      })
      notifyMessages(eventId)
    },
    async deleteMessage(eventId: string, messageId: string) {
      updateDb((db) => {
        const message = (db.chats[eventId] || []).find((entry) => entry.id === messageId)
        if (!message) return
        message.deleted = true
        message.text = ''
      })
      notifyMessages(eventId)
    },
    async setTyping(eventId: string, userId: string, typing: boolean) {
      updateDb((db) => {
        const entries = db.typing[eventId] || []
        const index = entries.findIndex((entry) => entry.uid === userId)
        const nextEntry: TypingState = { uid: userId, typing, updatedAt: new Date() }
        if (index >= 0) entries[index] = nextEntry
        else entries.push(nextEntry)
        db.typing[eventId] = entries
      })
      notifyTyping(eventId)
    },
  })
}