import type { FirebaseOptions } from 'firebase/app'

/**
 * Configuración web de Firebase (proyecto billis-juale86).
 * La apiKey viene de VITE_FIREBASE_API_KEY: en local desde .env.local, en GitHub Actions
 * desde el secret del repo. Sin clave, la lista compartida queda desactivada.
 */
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined

export const firebaseConfig: FirebaseOptions | null = apiKey
  ? {
      apiKey,
      authDomain: 'billis-juale86.firebaseapp.com',
      projectId: 'billis-juale86',
      storageBucket: 'billis-juale86.firebasestorage.app',
      messagingSenderId: '493253450675',
      appId: '1:493253450675:web:540c09f2e7fdb8aa18c9c6',
    }
  : null
