import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

let _adminInitialized = false
let _db: admin.firestore.Firestore | null = null
let _fcm: admin.messaging.Messaging | null = null

function ensureAdmin() {
  if (_adminInitialized) return
  admin.initializeApp()
  _adminInitialized = true
}

function db() {
  ensureAdmin()
  if (_db) return _db
  _db = admin.firestore()
  return _db
}

function fcm() {
  ensureAdmin()
  if (_fcm) return _fcm
  _fcm = admin.messaging()
  return _fcm
}

type SimplePayload = {
  notification?: { title: string; body?: string }
  data?: { [key: string]: string }
}

type NotifKind = 'event' | 'expense' | 'poll' | 'list' | 'chat'

// Telegram Helper
async function sendTelegramToUsers(userIds: string[], kind: NotifKind, message: string, url?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN || functions.config().telegram?.token
  if (!token) {
    console.warn('[Telegram] No bot token found. Set it via: firebase functions:config:set telegram.token="YOUR_TOKEN"')
    return
  }

  const chunks = [] as string[][]
  const size = 10
  for (let i = 0; i < userIds.length; i += size) chunks.push(userIds.slice(i, i + size))

  for (const group of chunks) {
    const snaps = await Promise.all(group.map(id => db().doc(`users/${id}`).get()))
    
    const promises = snaps.map(async (s) => {
      const doc = s.data()

      // Respect the same notification preferences as FCM
      const notif = doc?.notifications as any
      const pushEnabled = notif?.pushEnabled !== false
      const typeAllowed = notif?.types ? notif.types[kind] !== false : true
      if (!pushEnabled || !typeAllowed) return

      const chatId = doc?.notifications?.telegramChatId
      if (!chatId) return

      // Construct message with button if URL is present
      const body: any = {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      }

      if (url) {
        // Telegram requires full URL
        const fullUrl = `https://gvnapp-e3e7d.web.app${url}`
        body.reply_markup = {
          inline_keyboard: [[{ text: 'Apri App 📱', url: fullUrl }]]
        }
      }

      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
        if (!res.ok) {
          console.error(`[Telegram] Failed to send to ${chatId}:`, await res.text())
        }
      } catch (e) {
        console.error(`[Telegram] Error sending to ${chatId}:`, e)
      }
    })
    
    await Promise.all(promises)
  }
}

async function removeInvalidTokens(userIds: string[], badTokens: string[]) {
  // Fetch all user docs in parallel (was sequential loop → O(n) Firestore reads)
  const refs = userIds.map(uid => db().doc(`users/${uid}`))
  const snaps = await Promise.all(refs.map(r => r.get()))

  const batch = db().batch()
  let updates = 0

  snaps.forEach((snap) => {
    if (!snap.exists) return
    const data = snap.data()
    const currentTokens = data?.notifications?.fcmTokens
    if (Array.isArray(currentTokens)) {
      const newTokens = currentTokens.filter(t => !badTokens.includes(t))
      if (newTokens.length !== currentTokens.length) {
        batch.update(snap.ref, { 'notifications.fcmTokens': newTokens })
        updates++
      }
    }
  })

  if (updates > 0) {
    await batch.commit()
    console.log(`[FCM] Cleaned up invalid tokens for ${updates} users`)
  }
}

async function sendFcmToUsers(
  userIds: string[],
  kind: NotifKind,
  payload: SimplePayload,
  relatedId?: string,
  opts?: { skipInAppSave?: boolean }
) {
  if (userIds.length === 0) return

  // 1. Save to Firestore (In-App Notifications) - PERSISTENCE LAYER
  if (!opts?.skipInAppSave) {
    try {
      const now = admin.firestore.Timestamp.now()
      const notifDocs: { ref: admin.firestore.DocumentReference; data: Record<string, unknown> }[] = []

      userIds.forEach(uid => {
        const ref = db().collection('users').doc(uid).collection('notifications').doc()
        notifDocs.push({
          ref,
          data: {
            type: kind,
            title: payload.notification?.title || 'Nuova notifica',
            message: payload.notification?.body || '',
            createdAt: now,
            read: false,
            actionUrl: payload.data?.click_action || null,
            relatedId: relatedId || null
          }
        })
      })

      // Firestore batch limit is 500 operations; split into chunks of 499 to be safe.
      const BATCH_LIMIT = 499
      for (let i = 0; i < notifDocs.length; i += BATCH_LIMIT) {
        const chunk = notifDocs.slice(i, i + BATCH_LIMIT)
        const batch = db().batch()
        chunk.forEach(({ ref, data }) => batch.set(ref, data))
        await batch.commit()
      }
      console.log(`[Notifications] Saved ${userIds.length} in-app notifications for ${kind}`)
    } catch (e) {
      console.error('[Notifications] Failed to save in-app notifications:', e)
    }
  }

  // 2. Send Telegram (Alternative Channel) — respects same pushEnabled/types preferences as FCM
  try {
    const msg = `<b>${payload.notification?.title}</b>\n${payload.notification?.body}`
    await sendTelegramToUsers(userIds, kind, msg, payload.data?.click_action)
  } catch (e) {
    console.error('[Telegram] Failed to send notifications:', e)
  }

  // 3. Send FCM (Push Notifications)
  const rawTokens: string[] = []
  const chunks = [] as string[][]
  const size = 10
  for (let i = 0; i < userIds.length; i += size) chunks.push(userIds.slice(i, i + size))
  for (const group of chunks) {
    const snaps = await Promise.all(group.map(id => db().doc(`users/${id}`).get()))
    snaps.forEach(s => {
      const doc = s.data()
      const notif = doc?.notifications as any
      // Respect user's preferences: push enabled and specific kind not disabled
      const pushEnabled = notif?.pushEnabled !== false
      const typeAllowed = notif?.types ? notif.types[kind] !== false : true
      
      console.log(`[FCM] Checking user ${s.id}: pushEnabled=${pushEnabled}, typeAllowed=${typeAllowed}, kind=${kind}`)

      if (!pushEnabled || !typeAllowed) return
      const tSingle = notif?.fcmToken as string | undefined
      const tMany = notif?.fcmTokens as string[] | undefined
      
      if (tSingle) rawTokens.push(tSingle)
      if (tMany && Array.isArray(tMany)) rawTokens.push(...tMany)
      
      console.log(`[FCM] User ${s.id} tokens found: single=${!!tSingle}, arrayCount=${tMany?.length || 0}`)
    })
  }

  // Deduplicate: fcmToken and fcmTokens may overlap (addFcmToken stores in both)
  const tokens = Array.from(new Set(rawTokens))
  console.log(`[FCM] Total tokens to send: ${tokens.length} (${rawTokens.length} before dedup)`)
  if (tokens.length === 0) return
  
  try {
    const response = await fcm().sendEachForMulticast({
      tokens,
      notification: payload.notification,
      data: {
        // Merge caller-supplied data with kind/relatedId so the SW can build
        // a per-type/per-entity notification tag (avoids collapsing all into one).
        kind,
        relatedId: relatedId || '',
        ...payload.data,
      },
      android: {
        priority: 'high',
        notification: {
          priority: 'max',
          defaultSound: true,
          channelId: 'default'
        }
      },
      webpush: {
        headers: {
          Urgency: 'high'
        },
        fcmOptions: payload.data?.click_action ? { link: payload.data.click_action } : undefined
      }
    })
    console.log(`[FCM] Multicast result: success=${response.successCount}, failure=${response.failureCount}`)
    if (response.failureCount > 0) {
      const tokensToRemove: string[] = []
      response.responses.forEach((r, idx) => {
        if (!r.success) {
          console.error(`[FCM] Error sending to token ${tokens[idx].substring(0, 10)}...:`, r.error)
          const errCode = r.error?.code
          if (errCode === 'messaging/registration-token-not-registered' || errCode === 'messaging/invalid-registration-token') {
            tokensToRemove.push(tokens[idx])
          }
        }
      })
      
      if (tokensToRemove.length > 0) {
        await removeInvalidTokens(userIds, tokensToRemove)
      }
    }
  } catch (e) {
    console.error('[FCM] Fatal error sending multicast:', e)
  }
}

function getParticipantsUserIds(doc: admin.firestore.DocumentData): string[] {
  // Try participants arrays from events or expenses
  const participants = (doc.participants || []) as Array<{ userId: string }>
  const idsFromParticipants = participants.map(p => p.userId)
  const createdBy = doc.createdBy ? [doc.createdBy] : []
  // For expenses, include all participants plus payer
  const payer = doc.paidBy ? [doc.paidBy] : []
  const set = new Set([...idsFromParticipants, ...createdBy, ...payer])
  set.delete(doc.createdBy) // creator won’t receive a push
  return Array.from(set)
}

const toIsoString = (value: unknown): string | null => {
  if (!value) return null
  if (value instanceof admin.firestore.Timestamp) return value.toDate().toISOString()
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' || typeof value === 'number') {
    const candidate = new Date(value)
    if (!Number.isNaN(candidate.getTime())) return candidate.toISOString()
  }
  return null
}

// ---------------------------------------------------------------------------
// Auto-create default #generale channel when a farm is created.
// ---------------------------------------------------------------------------
export const onFarmCreated = functions.firestore
  .document('farms/{farmId}')
  .onCreate(async (snap, context) => {
    const farmId = context.params.farmId as string
    const data = snap.data()
    const ownerId = data?.ownerId as string | undefined
    if (!ownerId) return

    try {
      const channelsRef = db().collection('farms').doc(farmId).collection('channels')
      await channelsRef.add({
        farmId,
        name: 'generale',
        description: 'Il canale principale della fattoria',
        createdAt: admin.firestore.Timestamp.now(),
        createdBy: ownerId,
        isDefault: true,
        isArchived: false,
        lastMessageAt: null,
        lastMessagePreview: null,
      })
      console.log(`[FarmCreated] Default channel #generale created for farm ${farmId}`)
    } catch (e) {
      console.error(`[FarmCreated] Failed to create default channel for farm ${farmId}:`, e)
    }
  })

export const onEventCreated = functions.firestore.document('events/{id}').onCreate(async (snap: functions.firestore.DocumentSnapshot) => {
  const data = snap.data() as admin.firestore.DocumentData | undefined
  if (!data) return

  // Start with participants explicitly listed in the event document (minus the creator)
  let userIds = getParticipantsUserIds(data)

  // If the event has farm visibility, notify ALL farm members so they know about the event
  // even before they join it.  Members are stored in farms/{farmId}/members/{userId}.
  const farmIds: string[] = Array.isArray(data?.visibility?.farms) ? data.visibility.farms : []
  if (farmIds.length > 0) {
    for (const farmId of farmIds) {
      try {
        const membersSnap = await db().collection('farms').doc(farmId).collection('members').get()
        membersSnap.docs.forEach(d => {
          // member doc id == userId; also check data.userId as fallback
          const uid: string = (d.data()?.userId as string) || d.id
          if (uid && uid !== data.createdBy) userIds.push(uid)
        })
      } catch (e) {
        console.error(`[Event] Failed to fetch members for farm ${farmId}:`, e)
      }
    }
    // De-duplicate (a user might be both in participants and in the farm)
    userIds = Array.from(new Set(userIds))
  }

  if (userIds.length === 0) {
    console.log('[Event] No recipients for new event, skipping notifications')
    return
  }

  // Humanized message — data.date is a Firestore Timestamp; use .toDate() to get a JS Date
  const eventDate = data.date
    ? (typeof (data.date as any).toDate === 'function' ? (data.date as any).toDate() : new Date(data.date))
    : null
  const today = new Date(); today.setHours(0,0,0,0)
  const t = eventDate ? new Date(eventDate) : null
  const sameDay = t ? (new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime() === today.getTime()) : false
  const tomorrow = t ? (new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime() === today.getTime() + 86400000) : false
  const time = data.time ? ` alle ${data.time}` : ''
  const place = data.location ? ` • ${data.location}` : ''
  let title = 'Nuovo evento 🎉'
  let body = data.title ? String(data.title) : 'Si organizza qualcosa'
  if (sameDay) {
    title = 'Stasera si gioca? 🎉'
    body = `${data.title || 'Evento'}${time}${place}`
  } else if (tomorrow) {
    title = 'Domani si fa qualcosa? 🎉'
    body = `${data.title || 'Evento'}${time}${place}`
  } else if (t) {
    const when = t.toLocaleDateString('it-IT')
    body = `${data.title || 'Evento'} • ${when}${time}${place}`
  }
  await sendFcmToUsers(userIds, 'event', { notification: { title, body }, data: { click_action: `/events/${snap.id}/summary` } }, snap.id)
})

export const onExpenseCreated = functions.firestore.document('expenses/{id}').onCreate(async (snap: functions.firestore.DocumentSnapshot) => {
  const data = snap.data() as admin.firestore.DocumentData | undefined
  if (!data) return
  let userIds = getParticipantsUserIds(data)
  // Exclude the payer: getParticipantsUserIds already removes createdBy, but expenses use
  // `paidBy` (not `createdBy`) as the initiator. The payer created this expense themselves
  // and should not receive a push notification for their own action.
  const payer = typeof data.paidBy === 'string' ? data.paidBy : null
  if (payer) userIds = userIds.filter(id => id !== payer)
  const amount = typeof data.amount === 'number' ? `${data.amount.toFixed(2)}€` : ''
  const title = 'Nuova spesa 💰'
  const body = [data.title || 'Spesa', amount].filter(Boolean).join(' • ')
  await sendFcmToUsers(userIds, 'expense', { notification: { title, body }, data: { click_action: data.eventId ? `/events/${data.eventId}/summary` : '/expenses' } }, snap.id)
})

export const onPollCreated = functions.firestore.document('polls/{id}').onCreate(async (snap: functions.firestore.DocumentSnapshot) => {
  const data = snap.data() as admin.firestore.DocumentData | undefined
  if (!data) return
  let userIds = getParticipantsUserIds(data)
  // if linked to event, include event participants
  if (data.eventId) {
    const evSnap = await db().doc(`events/${data.eventId}`).get()
    const evParts = (evSnap.data()?.participants || []).map((p: any) => p.userId)
    userIds = Array.from(new Set([...userIds, ...evParts]))
  }
  const click = data.eventId ? `/events/${data.eventId}/summary` : '/polls'
  const title = 'Vota anche tu 🗳️'
  const body = data.title ? String(data.title) : 'C’è un nuovo sondaggio'
  await sendFcmToUsers(userIds, 'poll', { notification: { title, body }, data: { click_action: click } }, snap.id)
})

export const onListCreated = functions.firestore.document('lists/{id}').onCreate(async (snap: functions.firestore.DocumentSnapshot) => {
  const data = snap.data() as admin.firestore.DocumentData | undefined
  if (!data) return
  let userIds = getParticipantsUserIds(data)
  if (data.eventId) {
    const evSnap = await db().doc(`events/${data.eventId}`).get()
    const evParts = (evSnap.data()?.participants || []).map((p: any) => p.userId)
    userIds = Array.from(new Set([...userIds, ...evParts]))
  }
  const click = data.eventId ? `/events/${data.eventId}/summary` : '/lists'
  const title = 'Lista pronta 📝'
  const body = data.title ? String(data.title) : 'C’è una nuova lista'
  await sendFcmToUsers(userIds, 'list', { notification: { title, body }, data: { click_action: click } }, snap.id)
})

export const onChatMessageCreated = functions.firestore.document('events/{eventId}/messages/{messageId}').onCreate(async (snap, context) => {
  const message = snap.data()
  if (!message) return
  
  // Skip system messages (they are handled by other triggers like onExpenseCreated)
  if (message.type === 'system') return

  const eventId = context.params.eventId
  const eventSnap = await db().doc(`events/${eventId}`).get()
  const eventData = eventSnap.data()
  if (!eventData) return

  // Calculate recipients: all event participants + creator - sender
  const participants = (eventData.participants || []) as Array<{ userId: string }>
  const ids = participants.map(p => p.userId)
  if (eventData.createdBy) ids.push(eventData.createdBy)
  
  const senderId = message.userId
  const uniqueIds = new Set(ids)
  
  // DEBUG: Allow self-notification for testing if message is "test push"
  if (message.text?.toLowerCase() === 'test push') {
    console.log('[Chat] Test mode: Including sender in recipients')
    uniqueIds.add(senderId)
  } else {
    uniqueIds.delete(senderId)
  }
  
  const recipients = Array.from(uniqueIds)
  console.log(`[Chat] Processing message ${context.params.messageId} from ${senderId} in event ${eventId}`)
  console.log(`[Chat] Found ${ids.length} participants (incl creator). Recipients: ${recipients.length}`)

  if (recipients.length === 0) {
    console.log('[Chat] No recipients found, skipping push')
    return
  }

  const title = `${message.userName || 'Nuovo messaggio'} in ${eventData.title || 'Evento'}`
  const body = message.text || (message.attachments?.length ? '📷 Foto/File' : 'Nuovo messaggio')

  // In-app notification routing:
  // - normal chat: badge only on 💬 (client filters type='chat')
  // - @ mention: badge on 💬 + 🐷 (chatMention=true)
  try {
    const mentioned = Array.isArray(message.mentions) ? message.mentions.filter((x: any) => typeof x === 'string') as string[] : []
    const now = admin.firestore.Timestamp.now()
    const notifDocs: { ref: admin.firestore.DocumentReference; data: Record<string, unknown> }[] = []
    recipients.forEach(uid => {
      const ref = db().collection('users').doc(uid).collection('notifications').doc()
      notifDocs.push({
        ref,
        data: {
          type: 'chat',
          title,
          message: body,
          createdAt: now,
          read: false,
          actionUrl: `/events/${eventId}/chat`,
          relatedId: eventId,
          chatMention: mentioned.includes(uid)
        }
      })
    })
    // Firestore batch limit is 500 operations; split into chunks of 499 to be safe.
    const BATCH_LIMIT = 499
    for (let i = 0; i < notifDocs.length; i += BATCH_LIMIT) {
      const chunk = notifDocs.slice(i, i + BATCH_LIMIT)
      const batch = db().batch()
      chunk.forEach(({ ref, data }) => batch.set(ref, data))
      await batch.commit()
    }
    console.log(`[Chat] Saved ${recipients.length} in-app chat notifications (mentions=${mentioned.length})`)
  } catch (e) {
    console.error('[Chat] Failed to save in-app chat notifications:', e)
  }
  
  await sendFcmToUsers(recipients, 'chat', { 
    notification: { title, body }, 
    data: { click_action: `/events/${eventId}/chat` } 
  }, eventId, { skipInAppSave: true })
})

/**
 * Fires when someone replies inside a thread (events/{eventId}/messages/{msgId}/replies/{replyId}).
 * Notifies the original message author (if they are not the replier).
 */
export const onReplyCreated = functions.firestore
  .document('events/{eventId}/messages/{messageId}/replies/{replyId}')
  .onCreate(async (snap, context) => {
    const reply = snap.data()
    if (!reply) return

    const { eventId, messageId } = context.params

    // Load the parent message to find its author
    const parentSnap = await db().doc(`events/${eventId}/messages/${messageId}`).get()
    const parentData = parentSnap.data()
    if (!parentData) return

    const parentAuthorId: string = parentData.userId
    const replierId: string = reply.userId

    // Don't notify if the author replies to their own thread
    if (parentAuthorId === replierId) return

    const eventSnap = await db().doc(`events/${eventId}`).get()
    const eventData = eventSnap.data()
    const eventTitle: string = eventData?.title || 'Evento'

    const senderName: string = reply.userName || 'Qualcuno'
    const preview: string = reply.text
      ? reply.text.slice(0, 80)
      : (reply.attachments?.length ? '📷 Allegato' : 'Risposta nel thread')

    const title = `${senderName} ha risposto nel thread`
    const body = `"${preview}" in ${eventTitle}`
    const actionUrl = `/events/${eventId}/chat`

    // In-app notification for the parent author
    try {
      await db()
        .collection('users')
        .doc(parentAuthorId)
        .collection('notifications')
        .add({
          type: 'chat',
          title,
          message: body,
          createdAt: admin.firestore.Timestamp.now(),
          read: false,
          actionUrl,
          relatedId: eventId,
          chatMention: false,
        })
    } catch (e) {
      console.error('[Reply] Failed to save in-app notification:', e)
    }

    await sendFcmToUsers([parentAuthorId], 'chat', {
      notification: { title, body },
      data: { click_action: actionUrl },
    }, eventId, { skipInAppSave: true })
  })

export const publicEvent = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type,Origin')

  if (req.method === 'OPTIONS') {
    res.status(204).send('')
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method-not-allowed' })
    return
  }

  const rawId = (req.query.id ?? req.query.eventId ?? '').toString().trim()
  if (!rawId) {
    res.status(400).json({ error: 'missing-event-id' })
    return
  }

  try {
    const snap = await db().doc(`events/${rawId}`).get()
    if (!snap.exists) {
      res.status(404).json({ error: 'not-found' })
      return
    }

    const data = snap.data() as admin.firestore.DocumentData | undefined
    if (!data) {
      res.status(404).json({ error: 'not-found' })
      return
    }

    if (data.publicShareEnabled === false) {
      res.status(403).json({ error: 'sharing-disabled' })
      return
    }

    const participants = Array.isArray(data.participants) ? data.participants.filter(Boolean) : []
    res.status(200).json({
      id: snap.id,
      title: data.title ?? '',
      description: data.description ?? '',
      location: data.location ?? '',
      category: data.category ?? '',
      time: data.time ?? '',
      date: toIsoString(data.date),
      endDate: toIsoString(data.endDate),
      participantsCount: participants.length,
      publicShareEnabled: data.publicShareEnabled !== false,
    })
  } catch (err) {
    console.error('❌ publicEvent function error:', err)
    res.status(500).json({ error: 'internal-error' })
  }
})

// ---------------------------------------------------------------------------
// P0-3: onJoinRequestApproved
// Trigger: joinRequest status transitions to 'approved'.
// The client-side `approveJoinRequest` batch cannot write to another user's
// `userPrivate` doc (Firestore rules block cross-user writes). This function
// runs server-side (admin SDK, no rules) to safely update the approved user's
// farmIds and send them a push notification.
// ---------------------------------------------------------------------------
export const onJoinRequestApproved = functions.firestore
  .document('farms/{farmId}/joinRequests/{userId}')
  .onWrite(async (change, context) => {
    const before = change.before.data()
    const after = change.after.data()

    // Only act when status transitions to 'approved'
    const wasApproved = before?.status === 'approved'
    const isApproved = after?.status === 'approved'
    if (wasApproved || !isApproved) return

    const farmId = context.params.farmId as string
    const userId = context.params.userId as string

    console.log(`[JoinRequest] Approved: userId=${userId}, farmId=${farmId}`)

    try {
      // 1. Write userPrivate/{userId}.farmIds (arrayUnion so it is idempotent)
      const upRef = db().doc(`userPrivate/${userId}`)
      const upSnap = await upRef.get()
      const now = admin.firestore.Timestamp.now()

      if (upSnap.exists) {
        await upRef.update({
          farmIds: admin.firestore.FieldValue.arrayUnion(farmId),
          [`farms.${farmId}`]: { role: 'member', joinedAt: now },
          updatedAt: now,
        })
      } else {
        // Ensure doc exists (new user)
        await upRef.set({
          farmIds: [farmId],
          farms: { [farmId]: { role: 'member', joinedAt: now } },
          lastActiveFarmId: farmId,
          farmSettings: {},
          createdAt: now,
          updatedAt: now,
        })
      }
      console.log(`[JoinRequest] Updated userPrivate for ${userId}`)

      // 2. Fetch farm name for the notification body
      const farmSnap = await db().doc(`farms/${farmId}`).get()
      const farmName = (farmSnap.data()?.name as string | undefined) || 'una fattoria'

      // 3. Send push notification to the approved user
      await sendFcmToUsers(
        [userId],
        'event',
        {
          notification: {
            title: 'Richiesta approvata 🐷',
            body: `Sei ora membro di "${farmName}"!`,
          },
          data: { click_action: '/farm' },
        },
        farmId
      )
      console.log(`[JoinRequest] Push sent to ${userId}`)
    } catch (e) {
      console.error(`[JoinRequest] Error processing approval for ${userId} in ${farmId}:`, e)
    }
  })

// ---------------------------------------------------------------------------
// P1-3: onEventDeleted
// Trigger: events/{eventId} document is deleted.
// The client-side batch cannot recursively delete subcollections. This function
// cleans up messages, participants, typing subcollections and any Storage files.
// ---------------------------------------------------------------------------
export const onEventDeleted = functions.firestore
  .document('events/{eventId}')
  .onDelete(async (snap, context) => {
    const eventId = context.params.eventId as string
    console.log(`[EventDeleted] Cleaning up subcollections for event ${eventId}`)

    const BATCH_LIMIT = 499

    // Helper: delete all docs in a subcollection in batches
    async function deleteSubcollection(subPath: string): Promise<number> {
      const colRef = db().collection(subPath)
      let total = 0
      let snapshot = await colRef.limit(BATCH_LIMIT).get()

      while (!snapshot.empty) {
        const batch = db().batch()
        snapshot.docs.forEach(d => batch.delete(d.ref))
        await batch.commit()
        total += snapshot.docs.length
        // Continue if there might be more
        if (snapshot.docs.length < BATCH_LIMIT) break
        snapshot = await colRef.limit(BATCH_LIMIT).get()
      }

      return total
    }

    try {
      const [msgs, parts, typing] = await Promise.all([
        deleteSubcollection(`events/${eventId}/messages`),
        deleteSubcollection(`events/${eventId}/participants`),
        deleteSubcollection(`events/${eventId}/typing`),
      ])
      console.log(`[EventDeleted] Deleted subcollection docs: messages=${msgs}, participants=${parts}, typing=${typing}`)
    } catch (e) {
      console.error(`[EventDeleted] Error deleting subcollections for ${eventId}:`, e)
    }

    // Clean up Storage files under events/{eventId}/chat/
    try {
      const bucket = admin.storage().bucket()
      const [files] = await bucket.getFiles({ prefix: `events/${eventId}/chat/` })
      if (files.length > 0) {
        await Promise.all(files.map(f => f.delete().catch(() => {})))
        console.log(`[EventDeleted] Deleted ${files.length} Storage file(s) for event ${eventId}`)
      }
    } catch (e) {
      // Storage errors are non-fatal: log and continue
      console.warn(`[EventDeleted] Storage cleanup warning for ${eventId}:`, e)
    }
  })

// ---------------------------------------------------------------------------
// GDPR: exportUserData
// Returns all personal data stored for the authenticated user as a single JSON
// object. The client triggers a browser download of the result.
// ---------------------------------------------------------------------------
export const exportUserData = functions.https.onCall(async (_data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Devi essere autenticato per esportare i tuoi dati')
  }

  const uid = context.auth.uid

  try {
    // 1. User profile & notification settings (strip hardware tokens)
    const userSnap = await db().doc(`users/${uid}`).get()
    const userData = userSnap.data() || {}
    const rawNotif = userData.notifications as Record<string, unknown> | undefined
    const sanitizedNotifications = rawNotif
      ? { ...rawNotif, fcmToken: undefined, fcmTokens: undefined }
      : undefined

    // 2. Private user data (farmIds, farm roles)
    const privateSnap = await db().doc(`userPrivate/${uid}`).get()
    const privateData = privateSnap.exists ? (privateSnap.data() || {}) : {}

    // 3. Events (creator or participant)
    const [createdEventsSnap, participantEventsSnap] = await Promise.all([
      db().collection('events').where('createdBy', '==', uid).get(),
      db().collection('events').where('participantIds', 'array-contains', uid).get(),
    ])

    const eventMap = new Map<string, Record<string, unknown>>()
    const addEvent = (snap: admin.firestore.QuerySnapshot) => {
      snap.docs.forEach(d => {
        if (eventMap.has(d.id)) return
        const ev = d.data()
        const myParticipation = (ev.participation as Record<string, unknown> | undefined)?.[uid] ?? null
        const myEntry = Array.isArray(ev.participants)
          ? (ev.participants as Array<Record<string, unknown>>).find(p => p.userId === uid) ?? null
          : null
        eventMap.set(d.id, {
          id: d.id,
          title: ev.title ?? null,
          date: toIsoString(ev.date),
          endDate: toIsoString(ev.endDate),
          location: ev.location ?? null,
          description: ev.description ?? null,
          isCreator: ev.createdBy === uid,
          myParticipation,
          myParticipantEntry: myEntry,
        })
      })
    }
    addEvent(createdEventsSnap)
    addEvent(participantEventsSnap)
    const events = Array.from(eventMap.values())

    // 4. Expenses (payer or participant)
    const [paidExpensesSnap, partExpensesSnap] = await Promise.all([
      db().collection('expenses').where('paidBy', '==', uid).get(),
      db().collection('expenses').where('participantIds', 'array-contains', uid).get(),
    ])

    const expenseMap = new Map<string, Record<string, unknown>>()
    const addExpense = (snap: admin.firestore.QuerySnapshot) => {
      snap.docs.forEach(d => {
        if (expenseMap.has(d.id)) return
        const ex = d.data()
        const myEntry = Array.isArray(ex.participants)
          ? (ex.participants as Array<Record<string, unknown>>).find(p => p.userId === uid) ?? null
          : null
        expenseMap.set(d.id, {
          id: d.id,
          title: ex.title ?? null,
          amount: ex.amount ?? null,
          isPayer: ex.paidBy === uid,
          eventId: ex.eventId ?? null,
          createdAt: toIsoString(ex.createdAt),
          myParticipantEntry: myEntry,
        })
      })
    }
    addExpense(paidExpensesSnap)
    addExpense(partExpensesSnap)
    const expenses = Array.from(expenseMap.values())

    // 5. Payments (sender or receiver)
    const [sentPaymentsSnap, receivedPaymentsSnap] = await Promise.all([
      db().collection('payments').where('fromUserId', '==', uid).get(),
      db().collection('payments').where('toUserId', '==', uid).get(),
    ])

    const paymentMap = new Map<string, Record<string, unknown>>()
    const addPayment = (snap: admin.firestore.QuerySnapshot) => {
      snap.docs.forEach(d => {
        if (paymentMap.has(d.id)) return
        const p = d.data()
        paymentMap.set(d.id, {
          id: d.id,
          amount: p.amount ?? null,
          fromUserId: p.fromUserId ?? null,
          toUserId: p.toUserId ?? null,
          eventId: p.eventId ?? null,
          createdAt: toIsoString(p.createdAt),
        })
      })
    }
    addPayment(sentPaymentsSnap)
    addPayment(receivedPaymentsSnap)
    const payments = Array.from(paymentMap.values())

    // 6. Polls created by user
    const pollsSnap = await db().collection('polls').where('createdBy', '==', uid).get()
    const polls = pollsSnap.docs.map(d => {
      const p = d.data()
      return {
        id: d.id,
        title: p.title ?? null,
        eventId: p.eventId ?? null,
        options: Array.isArray(p.options) ? p.options : [],
        createdAt: toIsoString(p.createdAt),
      }
    })

    // 7. Lists created by user
    const listsSnap = await db().collection('lists').where('createdBy', '==', uid).get()
    const lists = listsSnap.docs.map(d => {
      const l = d.data()
      return {
        id: d.id,
        title: l.title ?? null,
        eventId: l.eventId ?? null,
        items: Array.isArray(l.items) ? l.items : [],
        createdAt: toIsoString(l.createdAt),
      }
    })

    // 8. In-app notifications (latest 500)
    const notifsSnap = await db()
      .collection('users').doc(uid).collection('notifications')
      .orderBy('createdAt', 'desc').limit(500)
      .get()
    const notifications = notifsSnap.docs.map(d => {
      const n = d.data()
      return {
        id: d.id,
        type: n.type ?? null,
        title: n.title ?? null,
        message: n.message ?? null,
        read: n.read ?? false,
        actionUrl: n.actionUrl ?? null,
        createdAt: toIsoString(n.createdAt),
      }
    })

    return {
      exportedAt: new Date().toISOString(),
      uid,
      profile: userData.profile ?? null,
      settings: sanitizedNotifications ? { notifications: sanitizedNotifications } : null,
      privateData: {
        farmIds: (privateData as Record<string, unknown>).farmIds ?? [],
      },
      events,
      expenses,
      payments,
      polls,
      lists,
      notifications,
    }
  } catch (e) {
    console.error('[exportUserData] Error:', e)
    throw new functions.https.HttpsError('internal', "Errore durante l'esportazione dei dati")
  }
})

// HTTPS callable for end-to-end push test from client
export const sendTestPush = functions.https.onCall(async (data, context) => {
  const uid = context.auth?.uid || (typeof data?.userId === 'string' ? data.userId : undefined)
  if (!uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Missing auth; sign in to request a test push')
  }
  await sendFcmToUsers([uid], 'event', {
    notification: { title: 'Ciao! 👋', body: 'Questa è una notifica di test' },
    data: { click_action: '/' }
  })
  return { ok: true }
})
