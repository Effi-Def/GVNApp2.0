import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  limit,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { Farm, FarmJoinRequest, FarmMembership } from '../../types'
import { toDate, toDateOrNow } from '../firestoreMappers'
import { userPrivateService } from './userPrivate'

export const farmReadService = {
  async listMembers(farmId: string): Promise<FarmMembership[]> {
    const q = query(collection(db, 'farms', farmId, 'members'), limit(200))
    const snap = await getDocs(q)

    const memberships = snap.docs.map(d => {
      const data: any = d.data()
      return {
        userId: String(data.userId || d.id),
        role: (data.role as any) || 'member',
        accessLevel: (data.accessLevel as any) || 'full',
        joinedAt: toDateOrNow(data.joinedAt),
        displayName: typeof data.displayName === 'string' ? data.displayName : undefined,
        photoURL: typeof data.photoURL === 'string' ? data.photoURL : undefined,
      } satisfies FarmMembership
    })

    const missing = memberships.filter(m => !m.displayName || !m.photoURL)
    if (missing.length) {
      const profileSnaps = await Promise.allSettled(
        missing.map(m => getDoc(doc(db, 'users', m.userId)).catch((e) => { throw e })),
      )
      const byUserId = new Map<string, { displayName?: string; photoURL?: string }>()
      missing.forEach((m, idx) => {
        const s = profileSnaps[idx]
        if (s.status !== 'fulfilled') return
        const snap = s.value
        if (!snap.exists()) return
        const data: any = snap.data()
        byUserId.set(m.userId, {
          displayName: typeof data.displayName === 'string' ? data.displayName : undefined,
          photoURL: typeof data.photoURL === 'string' ? data.photoURL : undefined,
        })
      })
      for (const m of memberships) {
        const p = byUserId.get(m.userId)
        if (!m.displayName && p?.displayName) m.displayName = p.displayName
        if (!m.photoURL && p?.photoURL) m.photoURL = p.photoURL
      }
    }

    memberships.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())
    return memberships
  },

  async getMyFarms(userId: string): Promise<Farm[]> {
    const up = await userPrivateService.get(userId)
    const ids = up.farmIds
    if (!ids.length) return []
    const snaps = await Promise.all(ids.map(id => getDoc(doc(db, 'farms', id)).catch(() => null)))
    const farms: Farm[] = []
    for (const s of snaps) {
      if (!s || !s.exists()) continue
      const data: any = s.data()
      farms.push({
        id: s.id,
        name: String(data.name || ''),
        ownerId: String(data.ownerId || ''),
        iconEmoji: typeof data.iconEmoji === 'string' ? data.iconEmoji : undefined,
        privacy: data.privacy === 'open' ? 'open' : (data.privacy === 'invite' ? 'invite' : undefined),
        inviteTokenId: typeof data.inviteTokenId === 'string' ? data.inviteTokenId : undefined,
        memberCount: typeof data.memberCount === 'number' ? data.memberCount : undefined,
        createdAt: toDateOrNow(data.createdAt),
        updatedAt: toDateOrNow(data.updatedAt),
      })
    }
    return farms
  },

  async getInvite(token: string): Promise<{ farmId: string; farmName?: string; active: boolean } | null> {
    const t = token.trim()
    if (!t) return null
    const inviteSnap = await getDoc(doc(db, 'farmInvites', t))
    if (!inviteSnap.exists()) return null
    const invite: any = inviteSnap.data()
    const farmId = String(invite.farmId || '')
    const active = invite.active !== false
    let farmName: string | undefined
    if (farmId) {
      const farmSnap = await getDoc(doc(db, 'farms', farmId)).catch(() => null)
      if (farmSnap?.exists()) {
        const fd: any = farmSnap.data()
        farmName = typeof fd.name === 'string' ? fd.name : undefined
      }
    }
    return farmId ? { farmId, farmName, active } : null
  },

  async listPendingJoinRequests(farmId: string): Promise<FarmJoinRequest[]> {
    const q = query(collection(db, 'farms', farmId, 'joinRequests'), limit(100))
    const snap = await getDocs(q)
    const mappedAll = snap.docs.map(d => {
      const data: any = d.data()
      const rawStatus = typeof data.status === 'string' ? data.status : (data.status as any)
      const statusNorm = String(rawStatus || '').trim().toLowerCase()
      return {
        id: d.id,
        userId: String(data.userId || d.id),
        status: (statusNorm || 'pending') as any,
        displayName: typeof data.displayName === 'string' ? data.displayName : undefined,
        photoURL: typeof data.photoURL === 'string' ? data.photoURL : undefined,
        createdAt: toDateOrNow(data.createdAt),
        updatedAt: toDate(data.updatedAt),
      } satisfies FarmJoinRequest
    })
    try {
      const statusCounts = mappedAll.reduce<Record<string, number>>((acc, r) => {
        const k = String(r.status || 'unknown')
        acc[k] = (acc[k] || 0) + 1
        return acc
      }, {})
      console.log('🐷 joinRequests debug', { farmId, total: mappedAll.length, statusCounts })
    } catch {}
    const pending = mappedAll.filter(r => r.status === 'pending')
    pending.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    return pending
  },
}
