"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTestPush = exports.onListCreated = exports.onPollCreated = exports.onExpenseCreated = exports.onEventCreated = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
const fcm = admin.messaging();
async function sendFcmToUsers(userIds, payload) {
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
            const notif = s.data()?.notifications;
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
exports.onEventCreated = functions.firestore.document('events/{id}').onCreate(async (snap) => {
    const data = snap.data();
    if (!data)
        return;
    const userIds = getParticipantsUserIds(data);
    await sendFcmToUsers(userIds, { notification: { title: 'Nuovo evento', body: data.title || 'È stato creato un evento' } });
});
exports.onExpenseCreated = functions.firestore.document('expenses/{id}').onCreate(async (snap) => {
    const data = snap.data();
    if (!data)
        return;
    const userIds = getParticipantsUserIds(data);
    await sendFcmToUsers(userIds, { notification: { title: 'Nuova spesa', body: data.title || 'È stata aggiunta una spesa' } });
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
    await sendFcmToUsers(userIds, {
        notification: { title: 'Nuovo sondaggio', body: data.title || 'È stato creato un sondaggio' },
        data: { click_action: click }
    });
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
    await sendFcmToUsers(userIds, {
        notification: { title: 'Nuova lista', body: data.title || 'È stata creata una lista' },
        data: { click_action: click }
    });
});
// HTTPS callable for end-to-end push test from client
exports.sendTestPush = functions.https.onCall(async (data, context) => {
    const uid = context.auth?.uid || (typeof data?.userId === 'string' ? data.userId : undefined);
    if (!uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Missing auth; sign in to request a test push');
    }
    await sendFcmToUsers([uid], {
        notification: { title: 'Test push', body: 'Notifica di test ricevuta' },
        data: { click_action: '/' }
    });
    return { ok: true };
});
//# sourceMappingURL=index.js.map