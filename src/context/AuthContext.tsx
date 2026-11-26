import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { 
  User, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithCredential,
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { auth, testConnection } from '../lib/firebase';
import { Capacitor } from '@capacitor/core';
import { androidGoogleClientId, isAndroid, nativeGoogleAccount } from '../lib/nativeGoogleAccount';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signingIn: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  clearError: () => void;
  isOnline: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const loginInFlight = useRef(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial connection test
    testConnection();

    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      },
      (authErr) => {
        console.error('Auth state error:', authErr);
        setError(authErr.message || 'Authentication error');
        setLoading(false);
      }
    );

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    if (loginInFlight.current) return;
    setError(null);
    const french = localStorage.getItem('mboafit_lang') === 'fr';
    if (Capacitor.isNativePlatform() && (!isAndroid || !androidGoogleClientId)) {
      setError(french
        ? 'La connexion Google Android n’est pas encore configurée dans cette bêta. La saisie manuelle reste disponible sans compte.'
        : 'Android Google sign-in is not configured in this beta yet. Manual logging remains available without an account.');
      return;
    }
    if (!navigator.onLine) {
      setError(french ? 'Reconnectez-vous à Internet pour utiliser votre compte Google.' : 'Reconnect to the internet to use your Google account.');
      return;
    }
    loginInFlight.current = true;
    setSigningIn(true);
    try {
      if (isAndroid) {
        const { idToken } = await nativeGoogleAccount.signIn({ webClientId: androidGoogleClientId });
        await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      } else {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await signInWithPopup(auth, provider);
      }
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === 'cancelled' || code === 'auth/popup-closed-by-user') return;
      setError(french ? 'La connexion Google a échoué. Réessayez ou continuez sans compte.'
        : 'Google sign-in failed. Try again or continue without an account.');
    } finally {
      loginInFlight.current = false;
      setSigningIn(false);
    }
  };

  const signOutUser = async () => {
    setError(null);
    try {
      await signOut(auth);
      if (isAndroid && androidGoogleClientId) await nativeGoogleAccount.clearSession();
    } catch (err: any) {
      console.error('Sign out error:', err);
      setError(err.message || 'Failed to sign out');
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signingIn,
      error,
      signInWithGoogle,
      signOutUser,
      clearError,
      isOnline
    }}>
      {children}
    </AuthContext.Provider>
  );
};
