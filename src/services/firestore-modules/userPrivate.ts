import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { UserPrivate } from '../../types'
import { toDate, toDateOrNow } from '../firestoreMappers'

export const userPrivateService = {
  async ensure(userId: string): Promise<void> {
    const refDoc = doc(db, 'userPrivate', userId)
    const snap = await getDoc(refDoc)
    if (snap.exists()) {
      await setDoc(refDoc, { updatedAt: Timestamp.now() }, { merge: true })
      return
    }
    await setDoc(refDoc, {
      farmIds: [],
      farms: {},
      lastActiveFarmId: null,
      farmSettings: {},
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
  },

  async get(userId: string): Promise<UserPrivate> {
    const refDoc = doc(db, 'userPrivate', userId)
    const snap = await getDoc(refDoc)
    if (!snap.exists()) {
      await this.ensure(userId)
      return {
        id: userId,
        farmIds: [],
        farms: {},
        lastActiveFarmId: undefined,
        farmSettings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    }
    const data: any = snap.data()
    const farmsRaw: any = data.farms && typeof data.farms === 'object' ? data.farms : {}
    const farms: UserPrivate['farms'] = {}
    for (const [farmId, info] of Object.entries(farmsRaw)) {
      const v: any = info
      const joinedAt = toDate(v?.joinedAt)
      const role = v?.role
      if (!joinedAt || (role !== 'owner' && role !== 'member')) continue
      farms[farmId] = { joinedAt, role }
    }
    const farmSettingsRaw: any = data.farmSettings && typeof data.farmSettings === 'object' ? data.farmSettings : {}
    const farmSettings: any = {}
    for (const [farmId, info] of Object.entries(farmSettingsRaw)) {
      const v: any = info
      const themeKey = typeof v?.themeKey === 'string' ? String(v.themeKey) : undefined
      farmSettings[String(farmId)] = {
        themeKey: (themeKey === 'default' || themeKey === 'cool' || themeKey === 'warm') ? themeKey : undefined,
      }
    }

    return {
      id: snap.id,
      farmIds: Array.isArray(data.farmIds) ? data.farmIds.filter((x: any) => typeof x === 'string') : [],
      farms,
      lastActiveFarmId: typeof data.lastActiveFarmId === 'string' && data.lastActiveFarmId.trim().length > 0
        ? String(data.lastActiveFarmId)
        : undefined,
      farmSettings,
      createdAt: toDateOrNow(data.createdAt),
      updatedAt: toDateOrNow(data.updatedAt),
    }
  },

  async getFarmIds(userId: string): Promise<string[]> {
    const up = await this.get(userId)
    return up.farmIds
  },

  async getLastActiveFarmId(userId: string): Promise<string | null> {
    const up = await this.get(userId)
    return up.lastActiveFarmId || null
  },

  async setLastActiveFarmId(userId: string, farmId: string | null): Promise<void> {
    await this.ensure(userId)
    const v = (farmId && farmId.trim().length > 0) ? farmId.trim() : null
    await setDoc(doc(db, 'userPrivate', userId), {
      lastActiveFarmId: v,
      updatedAt: Timestamp.now(),
    }, { merge: true })
  },

  async getFarmThemeKey(userId: string, farmId: string): Promise<string | null> {
    const up = await this.get(userId)
    const key = (up as any)?.farmSettings?.[farmId]?.themeKey
    return typeof key === 'string' ? key : null
  },

  async setFarmThemeKey(userId: string, farmId: string, themeKey: string | null): Promise<void> {
    await this.ensure(userId)
    const keyNorm = (themeKey && themeKey.trim().length > 0) ? themeKey.trim() : null
    await setDoc(doc(db, 'userPrivate', userId), {
      farmSettings: {
        [farmId]: {
          themeKey: keyNorm,
        },
      },
      updatedAt: Timestamp.now(),
    }, { merge: true })
  },
}
