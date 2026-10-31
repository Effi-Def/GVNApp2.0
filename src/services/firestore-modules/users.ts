import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { cleanUndefinedDeep } from '../firestoreMappers'

export const userService = {
  async get(userId: string): Promise<{ profile?: any; notifications?: any } | null> {
    try {
      const ref = doc(db, 'users', userId)
      const snap = await getDoc(ref)
      if (!snap.exists()) return null
      return snap.data() as any
    } catch (e) {
      console.error('❌ Error fetching user settings:', e)
      throw e
    }
  },

  async createOrUpdate(userId: string, data: any): Promise<void> {
    try {
      const ref = doc(db, 'users', userId)
      const { setDoc } = await import('firebase/firestore')
      const sanitized = cleanUndefinedDeep(data)
      await setDoc(ref, sanitized, { merge: true })
    } catch (e) {
      console.error('❌ Error creating/updating user settings:', e)
      throw e
    }
  },

  async updatePartial(userId: string, data: any): Promise<void> {
    try {
      const ref = doc(db, 'users', userId)
      const { setDoc } = await import('firebase/firestore')
      const sanitized = cleanUndefinedDeep(data)
      await setDoc(ref, sanitized, { merge: true })
    } catch (e) {
      console.error('❌ Error updating user settings:', e)
      throw e
    }
  },

  async updateNestedPartial(userId: string, nestedKey: string, partial: Record<string, unknown>): Promise<void> {
    try {
      const ref = doc(db, 'users', userId)
      const { updateDoc } = await import('firebase/firestore')
      const fields: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(partial)) {
        if (v !== undefined) fields[`${nestedKey}.${k}`] = v
      }
      if (Object.keys(fields).length > 0) await updateDoc(ref, fields)
    } catch (e) {
      console.error('❌ Error in updateNestedPartial:', e)
      throw e
    }
  },

  async addFcmToken(userId: string, token: string): Promise<void> {
    try {
      const { setDoc, arrayUnion } = await import('firebase/firestore')
      const ref = doc(db, 'users', userId)
      await setDoc(ref, {
        notifications: {
          fcmToken: token,
          fcmTokens: arrayUnion(token),
          pushEnabled: true,
        },
      }, { merge: true })
    } catch (e) {
      console.error('❌ Error adding FCM token:', e)
    }
  },
}
