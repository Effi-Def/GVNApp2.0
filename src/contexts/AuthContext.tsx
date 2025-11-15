import { createContext, useEffect, ReactNode } from 'react'
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  signOut 
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'
import { useAuthStore } from '../stores/useAuthStore'
import { User } from '../types'
import { isMobileDevice } from '../utils/deviceDetection'

export interface AuthContextType {
  signInWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { setUser, setLoading } = useAuthStore()

  useEffect(() => {
    console.log('🔥 AuthProvider: Setting up auth listener')
    
    // Check for redirect result on mount (for mobile devices)
    const checkRedirectResult = async () => {
      try {
        console.log('🔄 Checking for redirect result...')
        const result = await getRedirectResult(auth)
        if (result) {
          console.log('✅ Redirect result found:', result.user.email)
          // User will be processed by onAuthStateChanged
        } else {
          console.log('ℹ️ No redirect result found')
        }
      } catch (error) {
        console.error('❌ Error handling redirect result:', error)
        // Don't set loading to false here, let onAuthStateChanged handle it
      }
    }
    
    checkRedirectResult()
    
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
          const betterDisplayName =
            firebaseUser.displayName ||
            (firebaseUser.email ? firebaseUser.email.split('@')[0] : undefined) ||
            'Utente'
          
          if (userDoc.exists()) {
            console.log('✅ User document found in Firestore')
            userData = { id: firebaseUser.uid, ...userDoc.data() } as User
            // Fill missing fields from firebase user
            if (!userData.email && firebaseUser.email) userData.email = firebaseUser.email
            if (!userData.photoURL && firebaseUser.photoURL) userData.photoURL = firebaseUser.photoURL
            // Se il displayName è mancante o generico, aggiorniamo con uno migliore
            if (!userData.displayName || userData.displayName === 'Utente') {
              userData.displayName = betterDisplayName
              await setDoc(
                doc(db, 'users', firebaseUser.uid),
                { displayName: betterDisplayName },
                { merge: true }
              )
              console.log('✏️ Updated user displayName in Firestore')
            }
          } else {
            console.log('📝 Creating new user document in Firestore')
            // Crea un nuovo utente nel database
            userData = {
              id: firebaseUser.uid,
              email: firebaseUser.email!,
              displayName: betterDisplayName,
              photoURL: firebaseUser.photoURL || undefined,
              createdAt: new Date(),
            }
            
            await setDoc(doc(db, 'users', firebaseUser.uid), userData)
            console.log('✅ User document created successfully')
          }
          
          console.log('🎯 Setting user data:', userData)
          setUser(userData)
        } catch (error) {
          console.error('❌ Error processing user:', error)
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
    
    // Add additional scopes to get better user profile data
    provider.addScope('profile')
    provider.addScope('email')
    
    // Force account selection to avoid cached account issues
    provider.setCustomParameters({
      prompt: 'select_account'
    })
    
    try {
      const useMobile = isMobileDevice()
      console.log(`📱 Device type: ${useMobile ? 'Mobile (using redirect)' : 'Desktop (using popup)'}`)
      
      if (useMobile) {
        // Use redirect on mobile devices for better compatibility
        console.log('🔄 Starting redirect-based sign in...')
        await signInWithRedirect(auth, provider)
        // The result will be handled by getRedirectResult in useEffect
      } else {
        // Use popup on desktop for better UX
        console.log('🪟 Starting popup-based sign in...')
        const result = await signInWithPopup(auth, provider)
        console.log('✅ Google sign in successful:', result.user.email)
      }
    } catch (error: any) {
      console.error('❌ Error signing in with Google:', error)
      
      // Provide more helpful error messages
      if (error.code === 'auth/popup-blocked') {
        throw new Error('Il popup è stato bloccato. Permetti i popup per questo sito e riprova.')
      } else if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Login annullato.')
      } else if (error.code === 'auth/network-request-failed') {
        throw new Error('Errore di rete. Controlla la connessione internet e riprova.')
      } else if (error.code === 'auth/unauthorized-domain') {
        throw new Error('Dominio non autorizzato. Contatta l\'amministratore.')
      }
      
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
