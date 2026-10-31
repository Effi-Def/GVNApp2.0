import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  getDoc,
  writeBatch,
  arrayUnion,
  arrayRemove,
  increment,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { Farm, FarmMembership } from '../../types'
import { cleanUndefined } from '../firestoreMappers'
import { userPrivateService } from './userPrivate'

const generateInviteToken = (byteLen: number = 18): string => {
  const bytes = new Uint8Array(byteLen)
  crypto.getRandomValues(bytes)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function resolveInvite(token: string): Promise<{ farmId: string; active: boolean } | null> {
  const t = token.trim()
  if (!t) return null
  const inviteSnap = await getDoc(doc(db, 'farmInvites', t))
  if (!inviteSnap.exists()) return null
  const invite: any = inviteSnap.data()
  const farmId = String(invite.farmId || '')
  const active = invite.active !== false
  return farmId ? { farmId, active } : null
}

export const farmWriteService = {
  async finalizeMembership(params: { farmId: string; userId: string }): Promise<void> {
    const now = Timestamp.now()
    const memberSnap = await getDoc(doc(db, 'farms', params.farmId, 'members', params.userId)).catch(() => null)
    if (!memberSnap?.exists()) throw new Error('Non sei ancora membro del gruppo')

    await userPrivateService.ensure(params.userId)
    await setDoc(
      doc(db, 'userPrivate', params.userId),
      {
        farmIds: arrayUnion(params.farmId),
        farms: {
          [params.farmId]: { role: 'member', joinedAt: now },
        },
        updatedAt: now,
      },
      { merge: true },
    )
  },

  async createFarm(params: { name: string; ownerId: string; iconEmoji?: string; privacy?: Farm['privacy'] }): Promise<Farm> {
    const name = params.name.trim()
    if (!name) throw new Error('Nome gruppo obbligatorio')

    await userPrivateService.ensure(params.ownerId)

    const farmDocData: Record<string, unknown> = {
      name,
      ownerId: params.ownerId,
      privacy: params.privacy === 'open' ? 'open' : 'invite',
      memberCount: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }
    const trimmedEmoji = typeof params.iconEmoji === 'string' ? params.iconEmoji.trim() : ''
    if (trimmedEmoji) farmDocData.iconEmoji = trimmedEmoji

    const farmRef = await addDoc(collection(db, 'farms'), farmDocData)

    const token = generateInviteToken()
    const batch = writeBatch(db)

    batch.set(doc(db, 'farms', farmRef.id, 'members', params.ownerId), {
      userId: params.ownerId,
      role: 'owner',
      accessLevel: 'full',
      joinedAt: Timestamp.now(),
    } satisfies Omit<FarmMembership, 'joinedAt'> & { joinedAt: any })

    batch.set(doc(db, 'farmInvites', token), {
      farmId: farmRef.id,
      createdBy: params.ownerId,
      active: true,
      createdAt: Timestamp.now(),
    })

    batch.update(doc(db, 'farms', farmRef.id), {
      inviteTokenId: token,
      updatedAt: Timestamp.now(),
    })

    batch.set(doc(db, 'userPrivate', params.ownerId), {
      farmIds: arrayUnion(farmRef.id),
      farms: {
        [farmRef.id]: { role: 'owner', joinedAt: Timestamp.now() },
      },
      updatedAt: Timestamp.now(),
    }, { merge: true })

    await batch.commit()

    return {
      id: farmRef.id,
      name,
      ownerId: params.ownerId,
      ...(trimmedEmoji ? { iconEmoji: trimmedEmoji } : {}),
      privacy: params.privacy === 'open' ? 'open' : 'invite',
      inviteTokenId: token,
      memberCount: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  },

  async joinDirectlyByToken(params: {
    token: string
    user: { id: string; displayName?: string; photoURL?: string }
  }): Promise<string> {
    const invite = await resolveInvite(params.token)
    if (!invite || !invite.active) throw new Error('Invito non valido o scaduto')

    const farmId = invite.farmId
    const userId = params.user.id
    const now = Timestamp.now()

    await userPrivateService.ensure(userId)

    const existingMember = await getDoc(doc(db, 'farms', farmId, 'members', userId)).catch(() => null)
    if (existingMember?.exists()) {
      await setDoc(doc(db, 'userPrivate', userId), {
        farmIds: arrayUnion(farmId),
        farms: { [farmId]: { role: existingMember.data()?.role || 'member', joinedAt: existingMember.data()?.joinedAt || now } },
        updatedAt: now,
      }, { merge: true })
      return farmId
    }

    const batch = writeBatch(db)
    batch.set(doc(db, 'farms', farmId, 'members', userId), {
      userId,
      role: 'member',
      accessLevel: 'full',
      joinedAt: now,
      inviteToken: params.token,
    })
    batch.set(doc(db, 'userPrivate', userId), {
      farmIds: arrayUnion(farmId),
      farms: { [farmId]: { role: 'member', joinedAt: now } },
      updatedAt: now,
    }, { merge: true })
    await batch.commit()
    return farmId
  },

  async requestJoinByToken(params: { token: string; user: { id: string; displayName?: string; photoURL?: string } }): Promise<void> {
    const invite = await resolveInvite(params.token)
    if (!invite || !invite.active) throw new Error('Invito non valido')

    await userPrivateService.ensure(params.user.id)

    const reqRef = doc(db, 'farms', invite.farmId, 'joinRequests', params.user.id)

    const existing = await getDoc(reqRef).catch(() => null)
    if (existing?.exists()) {
      const data: any = existing.data()
      const statusNorm = String(data?.status || '').trim().toLowerCase()
      if (statusNorm === 'approved') {
        await this.finalizeMembership({ farmId: invite.farmId, userId: params.user.id })
        return
      }
      if (statusNorm === 'denied') {
        throw new Error('Richiesta negata dall\'admin del gruppo')
      }
      return
    }

    await setDoc(reqRef, cleanUndefined({
      userId: params.user.id,
      displayName: params.user.displayName || undefined,
      photoURL: params.user.photoURL || undefined,
      status: 'pending',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }), { merge: true })
  },

  async approveJoinRequest(params: { farmId: string; ownerId: string; userId: string }): Promise<void> {
    const now = Timestamp.now()
    const batch = writeBatch(db)
    batch.set(doc(db, 'farms', params.farmId, 'members', params.userId), {
      userId: params.userId,
      role: 'member',
      accessLevel: 'full',
      joinedAt: now,
    })
    batch.update(doc(db, 'farms', params.farmId), {
      memberCount: increment(1),
      updatedAt: now,
    })
    batch.set(doc(db, 'farms', params.farmId, 'joinRequests', params.userId), {
      status: 'approved',
      updatedAt: now,
    }, { merge: true })
    await batch.commit()
  },

  async denyJoinRequest(params: { farmId: string; ownerId: string; userId: string }): Promise<void> {
    await updateDoc(doc(db, 'farms', params.farmId, 'joinRequests', params.userId), {
      status: 'denied',
      updatedAt: Timestamp.now(),
    })
  },

  async regenerateInviteToken(params: { farmId: string; ownerId: string; currentToken?: string }): Promise<string> {
    const newToken = generateInviteToken()
    const batch = writeBatch(db)

    batch.set(doc(db, 'farmInvites', newToken), {
      farmId: params.farmId,
      createdBy: params.ownerId,
      active: true,
      createdAt: Timestamp.now(),
    })

    batch.update(doc(db, 'farms', params.farmId), {
      inviteTokenId: newToken,
      updatedAt: Timestamp.now(),
    })

    if (params.currentToken) {
      batch.delete(doc(db, 'farmInvites', params.currentToken))
    }

    await batch.commit()
    return newToken
  },

  async leaveFarm(params: { farmId: string; userId: string }): Promise<void> {
    const batch = writeBatch(db)
    batch.delete(doc(db, 'farms', params.farmId, 'members', params.userId))
    batch.set(doc(db, 'userPrivate', params.userId), {
      farmIds: arrayRemove(params.farmId),
      updatedAt: Timestamp.now(),
    }, { merge: true })
    batch.update(doc(db, 'farms', params.farmId), {
      memberCount: increment(-1),
      updatedAt: Timestamp.now(),
    })
    await batch.commit()
  },

  async removeMember(params: { farmId: string; ownerId: string; memberId: string }): Promise<void> {
    const farmSnap = await getDoc(doc(db, 'farms', params.farmId))
    if (!farmSnap.exists()) throw new Error('Gruppo non trovato')
    if (farmSnap.data().ownerId === params.memberId) {
      throw new Error('Non puoi rimuovere l\'admin dal gruppo')
    }
    const batch = writeBatch(db)
    batch.delete(doc(db, 'farms', params.farmId, 'members', params.memberId))
    batch.set(doc(db, 'userPrivate', params.memberId), {
      farmIds: arrayRemove(params.farmId),
      updatedAt: Timestamp.now(),
    }, { merge: true })
    batch.update(doc(db, 'farms', params.farmId), {
      memberCount: increment(-1),
      updatedAt: Timestamp.now(),
    })
    await batch.commit()
  },
}
