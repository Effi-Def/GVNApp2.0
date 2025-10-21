import { getDownloadURL, listAll, ref } from 'firebase/storage'
import type { FirebaseStorage } from 'firebase/storage'

export const AVATARS_CACHE_KEY = 'gvnapp:avatars:list'
export type AvatarsCache = { urls: string[]; ts: number }

export const loadCachedAvatars = (): AvatarsCache | null => {
  try {
    const raw = localStorage.getItem(AVATARS_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AvatarsCache
  } catch {
    return null
  }
}

export const saveCachedAvatars = (urls: string[]) => {
  try {
    const data: AvatarsCache = { urls, ts: Date.now() }
    localStorage.setItem(AVATARS_CACHE_KEY, JSON.stringify(data))
  } catch {}
}

export const prefetchImages = (urls: string[]) => {
  if (!urls || urls.length === 0) return
  if ('requestIdleCallback' in window) {
    ;(window as any).requestIdleCallback(() => urls.forEach(u => { const img = new Image(); img.src = u }))
  } else {
    setTimeout(() => urls.forEach(u => { const img = new Image(); img.src = u }), 0)
  }
}

// Fetch list of shared avatars from Storage and cache them locally
export const fetchAndCacheAvatars = async (storage: FirebaseStorage): Promise<string[]> => {
  try {
    const baseRef = ref(storage, 'avatars')
    const baseList = await listAll(baseRef)
    const urls = (await Promise.all(baseList.items.map(i => getDownloadURL(i).catch(() => null)))).filter((u): u is string => !!u)
    saveCachedAvatars(urls)
    prefetchImages(urls)
    return urls
  } catch (e) {
    // Do not throw; prefetch is best-effort
    return []
  }
}
