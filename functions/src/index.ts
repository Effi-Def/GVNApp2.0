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
async function sendTelegramToUsers(userIds: string[], message: string, url?: string) {
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
  const batch = db().batch()
  let updates = 0
  
  for (const uid of userIds) {
    const ref = db().doc(`users/${uid}`)
    const snap = await ref.get()
    if (!snap.exists) continue
    
    const data = snap.data()
    const currentTokens = data?.notifications?.fcmTokens
    
    if (Array.isArray(currentTokens)) {
      const newTokens = currentTokens.filter(t => !badTokens.includes(t))
      if (newTokens.length !== currentTokens.length) {
        batch.update(ref, { 'notifications.fcmTokens': newTokens })
        updates++
      }
    }
  }
  
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
      const batch = db().batch()
      const now = admin.firestore.Timestamp.now()
      
      userIds.forEach(uid => {
        const ref = db().collection('users').doc(uid).collection('notifications').doc()
        batch.set(ref, {
          type: kind,
          title: payload.notification?.title || 'Nuova notifica',
          message: payload.notification?.body || '',
          createdAt: now,
          read: false,
          actionUrl: payload.data?.click_action || null,
          relatedId: relatedId || null
        })
      })
      await batch.commit()
      console.log(`[Notifications] Saved ${userIds.length} in-app notifications for ${kind}`)
    } catch (e) {
      console.error('[Notifications] Failed to save in-app notifications:', e)
    }
  }

  // 2. Send Telegram (Alternative Channel)
  try {
    const msg = `<b>${payload.notification?.title}</b>\n${payload.notification?.body}`
    await sendTelegramToUsers(userIds, msg, payload.data?.click_action)
  } catch (e) {
    console.error('[Telegram] Failed to send notifications:', e)
  }

  // 3. Send FCM (Push Notifications)
  const tokens: string[] = []
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
      
      if (tSingle) tokens.push(tSingle)
      if (tMany && Array.isArray(tMany)) tokens.push(...tMany)
      
      console.log(`[FCM] User ${s.id} tokens found: single=${!!tSingle}, arrayCount=${tMany?.length || 0}`)
    })
  }
  
  console.log(`[FCM] Total tokens to send: ${tokens.length}`)
  if (tokens.length === 0) return
  
  try {
    const response = await fcm().sendEachForMulticast({
      tokens,
      notification: payload.notification,
      data: payload.data,
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

export const onEventCreated = functions.firestore.document('events/{id}').onCreate(async (snap: functions.firestore.DocumentSnapshot) => {
  const data = snap.data() as admin.firestore.DocumentData | undefined
  if (!data) return
  const userIds = getParticipantsUserIds(data)
  // Humanized message
  const eventDate = data.date ? new Date(data.date) : null
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
  const userIds = getParticipantsUserIds(data)
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
    const batch = db().batch()
    const now = admin.firestore.Timestamp.now()
    recipients.forEach(uid => {
      const ref = db().collection('users').doc(uid).collection('notifications').doc()
      batch.set(ref, {
        type: 'chat',
        title,
        message: body,
        createdAt: now,
        read: false,
        actionUrl: `/events/${eventId}/chat`,
        relatedId: eventId,
        chatMention: mentioned.includes(uid)
      })
    })
    await batch.commit()
    console.log(`[Chat] Saved ${recipients.length} in-app chat notifications (mentions=${recipients.filter(u => (Array.isArray(message.mentions) && (message.mentions as any).includes(u))).length})`)
  } catch (e) {
    console.error('[Chat] Failed to save in-app chat notifications:', e)
  }
  
  await sendFcmToUsers(recipients, 'chat', { 
    notification: { title, body }, 
    data: { click_action: `/events/${eventId}/chat` } 
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
