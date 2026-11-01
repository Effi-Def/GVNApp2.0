import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  runTransaction,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { ListItem, ShoppingList } from '../../types'
import { cleanUndefinedDeep, toDate } from '../firestoreMappers'

export const listWriteService = {
  async create(listData: Omit<ShoppingList, 'id' | 'createdAt' | 'updatedAt'>): Promise<ShoppingList> {
    try {
      console.log('📋 Creating new list:', listData.title)
      const dataToWrite = cleanUndefinedDeep({
        ...listData,
        sharedWith: listData.sharedWith || [listData.createdBy],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })

      const docRef = await addDoc(collection(db, 'lists'), dataToWrite)

      const newList: ShoppingList = {
        id: docRef.id,
        ...listData,
        sharedWith: listData.sharedWith || [listData.createdBy],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      console.log('✅ List created successfully:', newList.id)
      return newList
    } catch (error) {
      console.error('❌ Error creating list:', error)
      throw error
    }
  },

  async update(id: string, listData: Partial<ShoppingList>): Promise<void> {
    try {
      const docRef = doc(db, 'lists', id)
      const updateData: any = {
        ...listData,
        updatedAt: Timestamp.now(),
      }
      delete updateData.id
      delete updateData.createdAt
      const sanitized = cleanUndefinedDeep(updateData)
      // An explicit undefined here means "no longer linked", not "leave as it is"
      for (const key of ['eventId', 'farmId'] as const) {
        if (key in listData && listData[key] === undefined) sanitized[key] = deleteField()
      }

      await updateDoc(docRef, sanitized)
      console.log('✅ List updated successfully:', id)
    } catch (error) {
      console.error('❌ Error updating list:', error)
      const e: any = error
      if (e && (e.code || e.name === 'FirebaseError')) {
        throw e
      }
      throw new Error(`Errore durante l'aggiornamento della lista: ${e?.message ?? ''}`)
    }
  },

  /**
   * Applies a change on the latest saved items, so concurrent edits are not lost.
   * Transactions need the network: offline the change starts from `cachedItems` and is
   * queued by the SDK, so a list stays usable on a poor connection.
   */
  async changeItems(id: string, change: (items: ListItem[]) => ListItem[], cachedItems: ListItem[]): Promise<ListItem[]> {
    const docRef = doc(db, 'lists', id)
    if (!navigator.onLine) {
      const next = change(cachedItems)
      updateDoc(docRef, { items: cleanUndefinedDeep(next), updatedAt: Timestamp.now() })
        .catch(error => console.error('❌ Error syncing list items:', error))
      return next
    }
    return runTransaction(db, async (tx) => {
      const snap = await tx.get(docRef)
      if (!snap.exists()) throw new Error('Lista non trovata')
      const raw = snap.data().items
      const current: ListItem[] = Array.isArray(raw)
        ? raw.map((it: any) => ({
            ...it,
            addedAt: toDate(it?.addedAt),
            completedAt: toDate(it?.completedAt),
            dueDate: toDate(it?.dueDate),
          }))
        : []
      const next = change(current)
      tx.update(docRef, { items: cleanUndefinedDeep(next), updatedAt: Timestamp.now() })
      return next
    })
  },

  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'lists', id))
      console.log('✅ List deleted successfully:', id)
    } catch (error) {
      console.error('❌ Error deleting list:', error)
      throw new Error('Errore durante l\'eliminazione della lista')
    }
  },
}
