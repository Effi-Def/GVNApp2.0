import {
  collection,
  doc,
  addDoc,
  arrayUnion,
  updateDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { Poll, PollVote } from '../../types'
import { cleanUndefinedDeep } from '../firestoreMappers'

export const pollWriteService = {
  async create(pollData: Omit<Poll, 'id' | 'createdAt' | 'updatedAt' | 'votes'>): Promise<Poll> {
    try {
      console.log('📊 Creating new poll:', pollData.title)
      const dataToWrite = cleanUndefinedDeep({
        ...pollData,
        votes: [],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
      const docRef = await addDoc(collection(db, 'polls'), dataToWrite)

      const newPoll: Poll = {
        id: docRef.id,
        ...pollData,
        votes: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      console.log('✅ Poll created successfully:', newPoll.id)
      return newPoll
    } catch (error) {
      console.error('❌ Error creating poll:', error)
      throw new Error('Errore durante la creazione del sondaggio')
    }
  },

  async update(id: string, pollData: Partial<Poll>): Promise<void> {
    try {
      const docRef = doc(db, 'polls', id)
      const updateData = {
        ...pollData,
        updatedAt: Timestamp.now(),
      }
      delete updateData.id
      delete updateData.createdAt

      const sanitized = cleanUndefinedDeep(updateData)
      await updateDoc(docRef, sanitized)
      console.log('✅ Poll updated successfully:', id)
    } catch (error) {
      console.error('❌ Error updating poll:', error)
      throw new Error('Errore durante l\'aggiornamento del sondaggio')
    }
  },

  async vote(id: string, vote: PollVote): Promise<void> {
    try {
      await updateDoc(doc(db, 'polls', id), {
        votes: arrayUnion(cleanUndefinedDeep(vote)),
        updatedAt: Timestamp.now(),
      })
    } catch (error) {
      console.error('❌ Error recording vote:', error)
      throw new Error('Errore durante la registrazione del voto')
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'polls', id))
    } catch (error) {
      console.error('❌ Error deleting poll:', error)
      throw new Error('Errore durante l\'eliminazione del sondaggio')
    }
  },
}
