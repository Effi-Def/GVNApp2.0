import { createContext, useEffect, ReactNode } from 'react'
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'
import { useAuthStore } from '../stores/useAuthStore'
import { User } from '../types'

export interface AuthContextType {
  signInWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { setUser, setLoading } = useAuthStore()

  useEffect(() => {
    console.log('🔥 AuthProvider: Setting up auth listener')
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔐 Auth state changed:', firebaseUser ? 'User logged in' : 'User logged out')
      setLoading(true)
      
      if (firebaseUser) {
        console.log('👤 Processing user:', firebaseUser.uid, firebaseUser.email)
        try {
          // Verifica se l'utente esiste nel database
          console.log('📄 Checking user document in Firestore...')
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
          
          let userData: User
          
          if (userDoc.exists()) {
            console.log('✅ User document found in Firestore')
            userData = { id: firebaseUser.uid, ...userDoc.data() } as User
          } else {
            console.log('📝 Creating new user document in Firestore')
            // Crea un nuovo utente nel database
            userData = {
              id: firebaseUser.uid,
              email: firebaseUser.email!,
              displayName: firebaseUser.displayName || firebaseUser.email!.split('@')[0],
              photoURL: firebaseUser.photoURL || undefined,
              createdAt: new Date(),
            }
            
            await setDoc(doc(db, 'users', firebaseUser.uid), userData)
            console.log('✅ User document created successfully')
          }
          
          console.log('🎯 Setting user data:', userData)
          setUser(userData)
        } catch (error: any) {
          console.error('❌ Error processing user:', error)
          // Se è un errore di permessi, ignora (succede all'avvio prima dell'auth)
          if (error?.code === 'permission-denied') {
            console.log('⚠️ Permission denied (expected during initial load)')
            setLoading(false)
            return
          }
          // Se c'è un errore con Firestore, crea un utente temporaneo
          const tempUserData: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email!,
            displayName: firebaseUser.displayName || firebaseUser.email!.split('@')[0],
            photoURL: firebaseUser.photoURL || undefined,
            createdAt: new Date(),
          }
          console.log('⚠️ Using temporary user data due to Firestore error')
          setUser(tempUserData)
        }
      } else {
        console.log('👋 User logged out, clearing user data')
        setUser(null)
      }
      
      console.log('✅ Auth processing complete, setting loading to false')
      setLoading(false)
    })

    return () => unsubscribe()
  }, [setUser, setLoading])

  const signInWithGoogle = async () => {
    console.log('🚀 Attempting Google sign in...')
    const provider = new GoogleAuthProvider()
    try {
      const result = await signInWithPopup(auth, provider)
      console.log('✅ Google sign in successful:', result.user.email)
    } catch (error) {
      console.error('❌ Error signing in with Google:', error)
      throw error
    }
  }

  const logout = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Error signing out:', error)
      throw error
    }
  }

  const value = {
    signInWithGoogle,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
