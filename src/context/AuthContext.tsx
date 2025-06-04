
"use client";

import type { User as FirebaseUser, AuthError } from 'firebase/auth';
import { GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '@/lib/firebaseConfig'; // auth can be undefined if firebaseConfig fails
import { useToast } from '@/hooks/use-toast';

// Log the imported auth object immediately
console.log("--- AuthContext.tsx --- Imported 'auth' from firebaseConfig:", auth ? "DEFINED" : "UNDEFINED");

interface AuthContextType {
  currentUser: FirebaseUser | null;
  loading: boolean;
  signUpWithEmail: (email: string, pass: string) => Promise<FirebaseUser | null>;
  signInWithEmail: (email: string, pass: string) => Promise<FirebaseUser | null>;
  signInWithGoogle: () => Promise<FirebaseUser | null>;
  logout: () => Promise<void>;
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
  console.log("--- AuthProvider MOUNTING (AuthContext.tsx) --- 'auth' object is:", auth ? "DEFINED" : "UNDEFINED");
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    console.log("--- AuthProvider useEffect (AuthContext.tsx) --- Setting up onAuthStateChanged. 'auth' is:", auth ? "DEFINED" : "UNDEFINED");
    if (!auth) {
      console.error("--- AuthProvider useEffect (AuthContext.tsx) --- Firebase 'auth' service is UNDEFINED. Cannot set up onAuthStateChanged. This indicates a Firebase initialization problem in firebaseConfig.ts (e.g. API key missing/invalid).");
      setCurrentUser(null); // Ensure currentUser is null if auth is not available
      setLoading(false);    // Stop loading as auth state cannot be determined
      return; 
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("--- AuthProvider onAuthStateChanged (AuthContext.tsx) --- User state changed:", user ? user.uid : null);
      setCurrentUser(user);
      setLoading(false);
      console.log("--- AuthProvider onAuthStateChanged (AuthContext.tsx) --- Loading set to false. Current user:", user ? user.uid : null);
    }, (error) => {
      console.error("--- AuthProvider onAuthStateChanged ERROR (AuthContext.tsx) ---", error);
      setCurrentUser(null);
      setLoading(false);
      toast({
        title: "Auth State Error",
        description: "Could not verify authentication status. Please try refreshing.",
        variant: "destructive",
      });
    });
    
    return () => {
      console.log("--- AuthProvider useEffect CLEANUP (AuthContext.tsx) --- Unsubscribing from onAuthStateChanged.");
      unsubscribe();
    };
  }, []); // Empty dependency array: runs once on mount and cleans up on unmount

  const handleAuthError = (error: AuthError, defaultMessage: string) => {
    console.error("Authentication error (AuthContext.tsx):", error.code, error.message);
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
                message = 'Email/password accounts are not enabled.';
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
                message = 'Google Sign-In popup closed by user.';
                break;
            case 'auth/cancelled-popup-request':
            case 'auth/popup-blocked':
                 message = 'Google Sign-In popup was blocked or cancelled. Please enable popups for this site.';
                 break;
            default:
                message = error.message || defaultMessage;
        }
    }
    toast({
        title: 'Authentication Error',
        description: message,
        variant: 'destructive',
    });
    return null;
  }

  const signUpWithEmail = async (email: string, pass: string): Promise<FirebaseUser | null> => {
    if (!auth) {
      toast({ title: 'Error', description: 'Firebase authentication is not initialized.', variant: 'destructive' });
      return null;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will handle setCurrentUser
      toast({ title: 'Registration Successful', description: 'Welcome!' });
      router.push('/');
      return userCredential.user;
    } catch (error) {
      return handleAuthError(error as AuthError, 'Failed to register.');
    } finally {
      // setLoading(false); // onAuthStateChanged handles this
    }
  };

  const signInWithEmail = async (email: string, pass: string): Promise<FirebaseUser | null> => {
     if (!auth) {
      toast({ title: 'Error', description: 'Firebase authentication is not initialized.', variant: 'destructive' });
      return null;
    }
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will handle setCurrentUser
      toast({ title: 'Login Successful', description: 'Welcome back!' });
      router.push('/');
      return userCredential.user;
    } catch (error) {
      return handleAuthError(error as AuthError, 'Failed to sign in.');
    } finally {
      // setLoading(false); // onAuthStateChanged handles this
    }
  };

  const signInWithGoogle = async (): Promise<FirebaseUser | null> => {
     if (!auth) {
      toast({ title: 'Error', description: 'Firebase authentication is not initialized.', variant: 'destructive' });
      return null;
    }
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      // onAuthStateChanged will handle setCurrentUser
      toast({ title: 'Google Sign-In Successful', description: 'Welcome!' });
      router.push('/');
      return result.user;
    } catch (error) {
      return handleAuthError(error as AuthError, 'Failed to sign in with Google.');
    } finally {
      // setLoading(false); // onAuthStateChanged handles this
    }
  };

  const logout = async (): Promise<void> => {
    if (!auth) {
      toast({ title: 'Error', description: 'Firebase authentication is not initialized.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await signOut(auth);
      // onAuthStateChanged will handle setCurrentUser(null)
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
      router.push('/login'); // Explicit redirect after logout
    } catch (error) {
      console.error("Logout error (AuthContext.tsx):", error);
      toast({ title: 'Logout Error', description: (error as AuthError).message || 'Failed to log out.', variant: 'destructive' });
       setLoading(false); // Ensure loading is false on error too
    }
    // onAuthStateChanged will set loading to false
  };

  const value = {
    currentUser,
    loading,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    logout,
  };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

