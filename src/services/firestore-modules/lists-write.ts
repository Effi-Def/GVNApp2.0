import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { ShoppingList } from '../../types'
import { cleanUndefinedDeep } from '../firestoreMappers'

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
