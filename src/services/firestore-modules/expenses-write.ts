import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { Expense } from '../../types'
import { cleanUndefinedDeep } from '../firestoreMappers'

export const expenseWriteService = {
  async create(expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>): Promise<Expense> {
    try {
      console.log('💰 Creating new expense:', expenseData.title)

      if (!expenseData.eventId) {
        throw new Error('Seleziona un evento: ogni spesa deve appartenere a un evento')
      }

      const participantIds = [
        expenseData.paidBy,
        ...expenseData.participants.map(p => p.userId),
      ]
      const uniqueParticipantIds = [...new Set(participantIds)]

      const dataToWrite = cleanUndefinedDeep({
        ...expenseData,
        participantIds: uniqueParticipantIds,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })

      const docRef = await addDoc(collection(db, 'expenses'), dataToWrite)

      const newExpense: Expense = {
        id: docRef.id,
        ...expenseData,
        participantIds: uniqueParticipantIds,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      console.log('✅ Expense created successfully:', newExpense.id)
      return newExpense
    } catch (error) {
      console.error('❌ Error creating expense:', error)
      throw error
    }
  },

  async update(id: string, expenseData: Partial<Expense>): Promise<void> {
    try {
      const payload = cleanUndefinedDeep({
        ...expenseData,
        updatedAt: Timestamp.now(),
      })
      await updateDoc(doc(db, 'expenses', id), payload)
    } catch (error) {
      console.error('❌ Error updating expense:', error)
      throw new Error('Errore durante l\'aggiornamento della spesa')
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'expenses', id))
    } catch (error) {
      console.error('❌ Error deleting expense:', error)
      throw new Error('Errore durante l\'eliminazione della spesa')
    }
  },
}
