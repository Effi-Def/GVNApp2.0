import { create } from 'zustand'
import { Farm } from '../types'
import { farmService, userPrivateService } from '../services/firestore'
import { useAppStore } from './AppStore'
import { refreshActiveFarmData } from './useAuthStore'

const storageKeyFor = (userId: string) => `gvn.activeFarm.${userId}`

function readLocal(userId: string): string | null {
  try {
    const v = localStorage.getItem(storageKeyFor(userId))
    return v && v.trim().length > 0 ? v : null
  } catch {
    return null
  }
}

function writeLocal(userId: string, farmId: string | null) {
  try {
    const key = storageKeyFor(userId)
    if (!farmId) localStorage.removeItem(key)
    else localStorage.setItem(key, farmId)
  } catch {}
}

export interface ActiveFarmState {
  initializedForUserId: string | null
  initializing: boolean
  switching: boolean

  farms: Farm[]
  activeFarmId: string | null

  hydrateForUser: (params: { userId: string; farmIds: string[] }) => Promise<void>
  setActiveFarmId: (params: { userId: string; farmId: string | null }) => Promise<void>
}

export const useActiveFarmStore = create<ActiveFarmState>((set, get) => ({
  initializedForUserId: null,
  initializing: false,
  switching: false,

  farms: [],
  activeFarmId: null,

  hydrateForUser: async ({ userId, farmIds }) => {
    if (!userId) return

    const prevUserId = get().initializedForUserId
    const alreadyInit = prevUserId === userId && !get().initializing
    if (alreadyInit) {
      // If there are new farmIds not yet in our farms array, re-fetch to pick them up
      const currentFarmIds = new Set((get().farms || []).map(f => f.id))
      const hasNewFarms = farmIds.some(id => !currentFarmIds.has(id))
      if (hasNewFarms) {
        try {
          const updatedFarms = await farmService.getMyFarms(userId).catch(() => get().farms)
          set({ farms: updatedFarms })
        } catch {}
      }

      // Still validate activeFarmId exists in latest farmIds
      const cur = get().activeFarmId
      if (cur && !farmIds.includes(cur)) {
        const next = farmIds[0] || null
        set({ activeFarmId: next })
        writeLocal(userId, next)
        try {
          await userPrivateService.setLastActiveFarmId(userId, next)
        } catch {}
      }
      return
    }

    set({ initializing: true })
    try {
      // Fetch farms metadata
      const farms = await farmService.getMyFarms(userId).catch(() => [])

      // Determine last active farm id
      const [remoteLast, localLast] = await Promise.all([
        userPrivateService.getLastActiveFarmId(userId).catch(() => null),
        Promise.resolve(readLocal(userId)),
      ])

      const candidate = (remoteLast && farmIds.includes(remoteLast))
        ? remoteLast
        : ((localLast && farmIds.includes(localLast)) ? localLast : null)

      const activeFarmId = candidate || (farmIds[0] || null)

      set({ farms, activeFarmId, initializedForUserId: userId })
      writeLocal(userId, activeFarmId)

      // Persist back if remote is missing/out of date
      if (activeFarmId && remoteLast !== activeFarmId) {
        try {
          await userPrivateService.setLastActiveFarmId(userId, activeFarmId)
        } catch {}
      }
    } finally {
      set({ initializing: false })
    }
  },

  setActiveFarmId: async ({ userId, farmId }) => {
    set({ switching: true })

    // Clear stale data immediately so UI doesn't show events/chats from the old farm
    try {
      const store = useAppStore.getState()
      store.setEvents([])
      store.setExpenses([])
      store.setPolls([])
      store.setLists([])
    } catch {}

    set({ activeFarmId: farmId })
    writeLocal(userId, farmId)
    try {
      await userPrivateService.setLastActiveFarmId(userId, farmId)
    } catch {}

    // Reload data scoped to the new farm
    try {
      await refreshActiveFarmData()
    } catch {}

    set({ switching: false })
  },
}))
