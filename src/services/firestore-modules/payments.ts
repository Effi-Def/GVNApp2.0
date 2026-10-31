import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { PaymentTransaction } from '../../types'
import { toDateOrNow, cleanUndefinedDeep } from '../firestoreMappers'

export const paymentService = {
  async create(paymentData: Omit<PaymentTransaction, 'id' | 'createdAt'>): Promise<PaymentTransaction> {
    try {
      console.log('💸 Creating payment transaction:', paymentData.amount)
      const dataToWrite = cleanUndefinedDeep({
        ...paymentData,
        createdAt: Timestamp.now(),
      })
      const docRef = await addDoc(collection(db, 'payments'), dataToWrite)

      const newPayment: PaymentTransaction = {
        id: docRef.id,
        ...paymentData,
        createdAt: new Date(),
      }

      console.log('✅ Payment transaction created:', newPayment.id)
      return newPayment
    } catch (error) {
      console.error('❌ Error creating payment:', error)
      throw new Error('Errore durante la registrazione del pagamento')
    }
  },

  async getAll(): Promise<PaymentTransaction[]> {
    try {
      const q = query(collection(db, 'payments'), orderBy('createdAt', 'desc'))
      const querySnapshot = await getDocs(q)

      const payments: PaymentTransaction[] = querySnapshot.docs.map(d => {
        const data: any = d.data()
        return {
          id: d.id,
          ...data,
          createdAt: toDateOrNow(data.createdAt),
        }
      }) as PaymentTransaction[]

      return payments
    } catch (error) {
      console.error('❌ Error fetching payments:', error)
      throw new Error('Errore durante il caricamento dei pagamenti')
    }
  },

  async getByEvent(eventId: string): Promise<PaymentTransaction[]> {
    try {
      const q = query(
        collection(db, 'payments'),
        where('eventId', '==', eventId),
        orderBy('createdAt', 'desc'),
      )
      const querySnapshot = await getDocs(q)

      const payments: PaymentTransaction[] = querySnapshot.docs.map(d => {
        const data: any = d.data()
        return {
          id: d.id,
          ...data,
          createdAt: toDateOrNow(data.createdAt),
        }
      }) as PaymentTransaction[]

      return payments
    } catch (error) {
      console.error('❌ Error fetching payments for event:', error)
      throw new Error('Errore durante il caricamento dei pagamenti per l\'evento')
    }
  },

  async getForUser(userId: string): Promise<PaymentTransaction[]> {
    try {
      const [fromSnap, toSnap] = await Promise.allSettled([
        getDocs(query(collection(db, 'payments'), where('fromUserId', '==', userId), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'payments'), where('toUserId', '==', userId), orderBy('createdAt', 'desc'))),
      ])

      const byId = new Map<string, PaymentTransaction>()
      for (const result of [fromSnap, toSnap]) {
        if (result.status !== 'fulfilled') continue
        for (const d of result.value.docs) {
          const data: any = d.data()
          byId.set(d.id, {
            id: d.id,
            ...data,
            createdAt: toDateOrNow(data.createdAt),
          } as PaymentTransaction)
        }
      }

      return Array.from(byId.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    } catch (error) {
      console.error('❌ Error fetching payments for user:', error)
      throw new Error('Errore durante il caricamento dei pagamenti')
    }
  },
}
