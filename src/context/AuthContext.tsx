
"use client";

import type { User as FirebaseUser, AuthError } from 'firebase/auth';
import { GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, deleteUser } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebaseConfig'; // auth can be undefined if firebaseConfig fails
import { useToast } from '@/hooks/use-toast';
import { ref, set, get, remove } from "firebase/database";


// Log the imported auth object immediately
console.log("--- AuthContext.tsx --- MODULE EXECUTING. Imported 'auth' from firebaseConfig:", auth ? `DEFINED (App Name: ${auth.name})` : "UNDEFINED");

interface AuthContextType {
  currentUser: FirebaseUser | null;
  loading: boolean;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<FirebaseUser | null>;
  signInWithEmail: (email: string, pass: string) => Promise<FirebaseUser | null>;
  signInWithGoogle: () => Promise<FirebaseUser | null>;
  logout: () => Promise<void>;
  deleteCurrentUserAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  console.log("--- AuthProvider MOUNTING (AuthContext.tsx) --- 'auth' object status from import:", auth ? `DEFINED (App Name: ${auth.name})` : "UNDEFINED");
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    // This effect now handles theme logic based on the current route.
    const publicLightModeRoutes = ['/', '/login', '/register', '/privacy-policy', '/terms-of-service'];
    if (publicLightModeRoutes.includes(pathname)) {
      // On public-facing pages like landing and privacy, always force light theme.
      if (typeof window !== 'undefined') {
        document.documentElement.classList.remove('dark');
      }
    } else {
      // On all other pages (dashboard, etc.), respect the user's saved preference.
      if (typeof window !== 'undefined') {
        const storedDarkMode = localStorage.getItem('darkMode');
        if (storedDarkMode === 'true') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    }
  }, [pathname]); // Re-run this logic whenever the user navigates to a new page.


  useEffect(() => {
    console.log("--- AuthProvider useEffect (AuthContext.tsx) --- Setting up onAuthStateChanged. Current 'auth' service status:", auth ? `DEFINED (App Name: ${auth.name})` : "UNDEFINED");
    if (!auth) {
      console.error("--- AuthProvider useEffect (AuthContext.tsx) --- CRITICAL: Firebase 'auth' service is UNDEFINED. Cannot set up onAuthStateChanged. Firebase might not have initialized correctly in firebaseConfig.ts (e.g., API key missing/invalid or other init error). Authentication will not work.");
      setCurrentUser(null);
      setLoading(false);
      toast({
        title: "Authentication System Error",
        description: "Firebase auth service is not available. Please contact support or check console.",
        variant: "destructive",
      });
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("--- AuthProvider onAuthStateChanged (AuthContext.tsx) --- User state changed. User ID:", user ? user.uid : "null", "App Name:", auth.name);
      setCurrentUser(user);
      setLoading(false);
      console.log("--- AuthProvider onAuthStateChanged (AuthContext.tsx) --- Loading set to false. Current user:", user ? user.uid : "null");
    }, (error) => {
      console.error("--- AuthProvider onAuthStateChanged ERROR (AuthContext.tsx) ---", error, "App Name:", auth.name);
      setCurrentUser(null);
      setLoading(false);
      toast({
        title: "Auth State Error",
        description: "Could not verify authentication status. Please try refreshing.",
        variant: "destructive",
      });
    });
    
    return () => {
      console.log("--- AuthProvider useEffect CLEANUP (AuthContext.tsx) --- Unsubscribing from onAuthStateChanged for app:", auth?.name || "N/A");
      unsubscribe();
    };
  }, []); 

  const ensureUserRecordInDB = async (user: FirebaseUser) => {
    if (!db || !user || !user.email) return;
    const userRef = ref(db, `Users/${user.uid}`);
    const snapshot = await get(userRef);
    if (!snapshot.exists()) {
      console.log(`Creating database record for new user: ${user.uid}`);
      try {
        await set(userRef, {
          email: user.email,
          name: user.displayName,
          createdAt: new Date().toISOString(),
        });
      } catch (dbError) {
        console.error("Failed to create user record in RTDB:", dbError);
        // This is a background task. We don't toast here to avoid interrupting the user flow.
      }
    }
  };

  const handleAuthError = (error: AuthError, defaultMessage: string, operation?: 'googleSignIn') => {
    console.error(`Authentication error during ${operation || 'operation'} (AuthContext.tsx for app: ${auth?.name || 'N/A'}):`, error.code, error.message);
    let message = defaultMessage;
    if (error.code) {
        switch (error.code) {
            case 'auth/email-already-in-use':
                message = 'This email address is already in use.';
                break;
            case 'auth/invalid-email':
                message = 'The email address is not valid.';
                break;
            case 'auth/operation-not-allowed':
                message = operation === 'googleSignIn' 
                    ? 'Google Sign-In is not enabled or configured correctly for this project. Please check Firebase and Google Cloud Console OAuth settings (Authorized JavaScript Origins, Redirect URIs, and OAuth Consent Screen).' 
                    : 'Email/password accounts are not enabled.';
                break;
            case 'auth/weak-password':
                message = 'The password is too weak.';
                break;
            case 'auth/user-disabled':
                message = 'This user account has been disabled.';
                break;
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                 message = 'Invalid email or password.';
                 break;
            case 'auth/popup-closed-by-user':
                message = 'Google Sign-In popup closed by user. If it appeared blank or showed an error, check Google Cloud OAuth configuration (Authorized JavaScript Origins, Redirect URIs, Consent Screen).';
                break;
            case 'auth/cancelled-popup-request':
            case 'auth/popup-blocked':
                 message = 'Google Sign-In popup was blocked or cancelled. Please enable popups for this site and check Google Cloud OAuth configuration.';
                 break;
            case 'auth/auth-domain-config-required':
                 message = 'Google Sign-In failed. The authentication domain might not be configured correctly or authorized. Check Firebase Auth settings and Google Cloud OAuth "Authorized JavaScript origins".';
                 break;
            case 'auth/unauthorized-domain':
                 message = 'This domain is not authorized for OAuth operations. Check your Google Cloud Console OAuth Client ID "Authorized JavaScript origins" and Firebase "Authorized domains".';
                 break;
            case 'auth/invalid-credential':
                 message = 'Invalid credential provided. For Google Sign-In, this can indicate a problem with the OAuth configuration or the token received from Google.';
                 break;
             case 'auth/requires-recent-login':
                message = 'This is a sensitive action and requires a recent login. Please sign out and sign back in to delete your account.';
                break;
            default:
                message = `(${error.code}) ${error.message || defaultMessage}`;
        }
    }
    toast({
        title: 'Authentication Error',
        description: message,
        variant: 'destructive',
    });
    return null;
  }

  const signUpWithEmail = async (email: string, pass: string, name: string): Promise<FirebaseUser | null> => {
    if (!auth) {
      toast({ title: 'Error', description: 'Firebase authentication is not initialized. Cannot sign up.', variant: 'destructive' });
      return null;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(userCredential.user, { displayName: name });
      await ensureUserRecordInDB(userCredential.user);
      toast({ title: 'Registration Successful', description: 'Welcome!' });
      router.push('/dashboard');
      return userCredential.user;
    } catch (error) {
      return handleAuthError(error as AuthError, 'Failed to register.');
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, pass: string): Promise<FirebaseUser | null> => {
     if (!auth) {
      toast({ title: 'Error', description: 'Firebase authentication is not initialized. Cannot sign in.', variant: 'destructive' });
      return null;
    }
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      await ensureUserRecordInDB(userCredential.user);
      toast({ title: 'Login Successful', description: 'Welcome back!' });
      router.push('/dashboard');
      return userCredential.user;
    } catch (error) {
      return handleAuthError(error as AuthError, 'Failed to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async (): Promise<FirebaseUser | null> => {
     if (!auth) {
      toast({ title: 'Error', description: 'Firebase authentication is not initialized. Cannot sign in with Google.', variant: 'destructive' });
      return null;
    }
    setLoading(true);
    console.log(`--- AuthContext.tsx --- Attempting Google Sign-In. Firebase App Name: '${auth.name}', Auth Domain: '${auth.config.authDomain}'. Ensure these match your GCP OAuth Client 'Authorized JavaScript origins' and Firebase 'Authorized domains'.`);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await ensureUserRecordInDB(result.user);
      toast({ title: 'Google Sign-In Successful', description: 'Welcome!' });
      router.push('/dashboard');
      return result.user;
    } catch (error) {
      console.error("--- AuthContext.tsx --- Google Sign-In failed:", error);
      return handleAuthError(error as AuthError, 'Failed to sign in with Google. Check console for details.', 'googleSignIn');
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    if (!auth) {
      toast({ title: 'Error', description: 'Firebase authentication is not initialized. Cannot log out.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await signOut(auth);
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
      router.push('/login'); 
    } catch (error) {
      console.error("Logout error (AuthContext.tsx for app: ${auth?.name || 'N/A'}):", error);
      toast({ title: 'Logout Error', description: (error as AuthError).message || 'Failed to log out.', variant: 'destructive' });
    } finally {
       setLoading(false); // Ensure loading is set to false even on logout error
    }
  };
  
  const deleteCurrentUserAccount = async (): Promise<void> => {
    if (!auth || !currentUser || !db) {
      toast({ title: 'Error', description: 'Not logged in or services unavailable.', variant: 'destructive' });
      return;
    }

    const userId = currentUser.uid;
    
    // An array of promises for all the database deletion operations
    const deleteDbPromises = [
        remove(ref(db, `Users/${userId}`)),
        remove(ref(db, `UserPreferences/${userId}`)),
        remove(ref(db, `Appointments/${userId}`)),
        remove(ref(db, `Clients/${userId}`))
    ];

    try {
        console.log(`Starting account deletion for user ${userId}.`);
        
        // 1. Delete all database records concurrently
        await Promise.all(deleteDbPromises);
        console.log(`Successfully deleted all database records for user ${userId}.`);

        // 2. Delete the user from Firebase Authentication
        await deleteUser(currentUser);
        console.log(`Successfully deleted auth user ${userId}.`);

        toast({ title: "Account Deleted", description: "Your account and all associated data have been permanently deleted." });
        // The onAuthStateChanged listener will automatically handle the redirect to /login
    } catch (error: any) {
        console.error(`Error deleting account for user ${userId}:`, error);
        handleAuthError(error, 'Failed to delete your account.');
    }
  };

  const value = {
    currentUser,
    loading,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    logout,
    deleteCurrentUserAccount,
  };
  
  console.log("--- AuthProvider (AuthContext.tsx) --- Rendering with value:", { currentUser: currentUser?.uid || null, loading, appName: auth?.name || "N/A" });
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
