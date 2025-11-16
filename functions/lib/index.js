"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTestPush = exports.publicEvent = exports.onListCreated = exports.onPollCreated = exports.onExpenseCreated = exports.onEventCreated = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
const fcm = admin.messaging();
async function sendFcmToUsers(userIds, kind, payload) {
    if (userIds.length === 0)
        return;
    // fetch tokens for users
    const tokens = [];
    const chunks = [];
    const size = 10;
    for (let i = 0; i < userIds.length; i += size)
        chunks.push(userIds.slice(i, i + size));
    for (const group of chunks) {
        const snaps = await Promise.all(group.map(id => db.doc(`users/${id}`).get()));
        snaps.forEach(s => {
            const doc = s.data();
            const notif = doc?.notifications;
            // Respect user's preferences: push enabled and specific kind not disabled
            const pushEnabled = notif?.pushEnabled !== false;
            const typeAllowed = notif?.types ? notif.types[kind] !== false : true;
            if (!pushEnabled || !typeAllowed)
                return;
            const tSingle = notif?.fcmToken;
            const tMany = notif?.fcmTokens;
            if (tSingle)
                tokens.push(tSingle);
            if (tMany && Array.isArray(tMany))
                tokens.push(...tMany);
        });
    }
    if (tokens.length === 0)
        return;
    await fcm.sendEachForMulticast({
        tokens,
        notification: payload.notification,
        data: payload.data,
        webpush: {
            fcmOptions: payload.data?.click_action ? { link: payload.data.click_action } : undefined
        }
    });
}
function getParticipantsUserIds(doc) {
    // Try participants arrays from events or expenses
    const participants = (doc.participants || []);
    const idsFromParticipants = participants.map(p => p.userId);
    const createdBy = doc.createdBy ? [doc.createdBy] : [];
    // For expenses, include all participants plus payer
    const payer = doc.paidBy ? [doc.paidBy] : [];
    const set = new Set([...idsFromParticipants, ...createdBy, ...payer]);
    set.delete(doc.createdBy); // creator won’t receive a push
    return Array.from(set);
}
const toIsoString = (value) => {
    if (!value)
        return null;
    if (value instanceof admin.firestore.Timestamp)
        return value.toDate().toISOString();
    if (value instanceof Date)
        return value.toISOString();
    if (typeof value === 'string' || typeof value === 'number') {
        const candidate = new Date(value);
        if (!Number.isNaN(candidate.getTime()))
            return candidate.toISOString();
    }
    return null;
};
exports.onEventCreated = functions.firestore.document('events/{id}').onCreate(async (snap) => {
    const data = snap.data();
    if (!data)
        return;
    const userIds = getParticipantsUserIds(data);
    // Humanized message
    const eventDate = data.date ? new Date(data.date) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const t = eventDate ? new Date(eventDate) : null;
    const sameDay = t ? (new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime() === today.getTime()) : false;
    const tomorrow = t ? (new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime() === today.getTime() + 86400000) : false;
    const time = data.time ? ` alle ${data.time}` : '';
    const place = data.location ? ` • ${data.location}` : '';
    let title = 'Nuovo evento 🎉';
    let body = data.title ? String(data.title) : 'Si organizza qualcosa';
    if (sameDay) {
        title = 'Stasera si gioca? 🎉';
        body = `${data.title || 'Evento'}${time}${place}`;
    }
    else if (tomorrow) {
        title = 'Domani si fa qualcosa? 🎉';
        body = `${data.title || 'Evento'}${time}${place}`;
    }
    else if (t) {
        const when = t.toLocaleDateString('it-IT');
        body = `${data.title || 'Evento'} • ${when}${time}${place}`;
    }
    await sendFcmToUsers(userIds, 'event', { notification: { title, body }, data: { click_action: `/events/${snap.id}/summary` } });
});
exports.onExpenseCreated = functions.firestore.document('expenses/{id}').onCreate(async (snap) => {
    const data = snap.data();
    if (!data)
        return;
    const userIds = getParticipantsUserIds(data);
    const amount = typeof data.amount === 'number' ? `${data.amount.toFixed(2)}€` : '';
    const title = 'Nuova spesa 💰';
    const body = [data.title || 'Spesa', amount].filter(Boolean).join(' • ');
    await sendFcmToUsers(userIds, 'expense', { notification: { title, body }, data: { click_action: data.eventId ? `/events/${data.eventId}/summary` : '/expenses' } });
});
exports.onPollCreated = functions.firestore.document('polls/{id}').onCreate(async (snap) => {
    const data = snap.data();
    if (!data)
        return;
    let userIds = getParticipantsUserIds(data);
    // if linked to event, include event participants
    if (data.eventId) {
        const evSnap = await db.doc(`events/${data.eventId}`).get();
        const evParts = (evSnap.data()?.participants || []).map((p) => p.userId);
        userIds = Array.from(new Set([...userIds, ...evParts]));
    }
    const click = data.eventId ? `/events/${data.eventId}/summary` : '/polls';
    const title = 'Vota anche tu 🗳️';
    const body = data.title ? String(data.title) : 'C’è un nuovo sondaggio';
    await sendFcmToUsers(userIds, 'poll', { notification: { title, body }, data: { click_action: click } });
});
exports.onListCreated = functions.firestore.document('lists/{id}').onCreate(async (snap) => {
    const data = snap.data();
    if (!data)
        return;
    let userIds = getParticipantsUserIds(data);
    if (data.eventId) {
        const evSnap = await db.doc(`events/${data.eventId}`).get();
        const evParts = (evSnap.data()?.participants || []).map((p) => p.userId);
        userIds = Array.from(new Set([...userIds, ...evParts]));
    }
    const click = data.eventId ? `/events/${data.eventId}/summary` : '/lists';
    const title = 'Lista pronta 📝';
    const body = data.title ? String(data.title) : 'C’è una nuova lista';
    await sendFcmToUsers(userIds, 'list', { notification: { title, body }, data: { click_action: click } });
});
exports.publicEvent = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type,Origin');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'method-not-allowed' });
        return;
    }
    const rawId = (req.query.id ?? req.query.eventId ?? '').toString().trim();
    if (!rawId) {
        res.status(400).json({ error: 'missing-event-id' });
        return;
    }
    try {
        const snap = await db.doc(`events/${rawId}`).get();
        if (!snap.exists) {
            res.status(404).json({ error: 'not-found' });
            return;
        }
        const data = snap.data();
        if (!data) {
            res.status(404).json({ error: 'not-found' });
            return;
        }
        if (data.publicShareEnabled === false) {
            res.status(403).json({ error: 'sharing-disabled' });
            return;
        }
        const participants = Array.isArray(data.participants) ? data.participants.filter(Boolean) : [];
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
        });
    }
    catch (err) {
        console.error('❌ publicEvent function error:', err);
        res.status(500).json({ error: 'internal-error' });
    }
});
// HTTPS callable for end-to-end push test from client
exports.sendTestPush = functions.https.onCall(async (data, context) => {
    const uid = context.auth?.uid || (typeof data?.userId === 'string' ? data.userId : undefined);
    if (!uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Missing auth; sign in to request a test push');
    }
    await sendFcmToUsers([uid], 'event', {
        notification: { title: 'Ciao! 👋', body: 'Questa è una notifica di test' },
        data: { click_action: '/' }
    });
    return { ok: true };
});
//# sourceMappingURL=index.js.map