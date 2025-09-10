import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGoogle, signOutUser, isAuthorizedEmail } from '@/lib/firebase';
import { fetchGeminiApiKey } from '@/services/geminiApiService';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Check authorization for the current user
        try {
          const authorized = await isAuthorizedEmail(user.email);
          if (!authorized) {
            // Sign out unauthorized users immediately
            await signOutUser();
            setUser(null);
            setError('User not authorized.');
          } else {
            setUser(user);
            setError(null); // Clear any previous errors for authorized users
          }
        } catch (error) {
          console.error('Error checking user authorization:', error);
          // If authorization check fails, sign out for safety
          await signOutUser();
          setUser(null);
          setError('Authorization check failed. Please try again.');
        }
      } else {
        setUser(null);
        setError(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // signInWithGoogle always returns a user (popup flow)
      const user = await signInWithGoogle();
      setUser(user || null);
    } catch (error: any) {
      setError(error.message || 'An error occurred during sign in');
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      setError(null);
      await signOutUser();
      setUser(null);
    } catch (error: any) {
      setError(error.message || 'An error occurred during sign out');
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    loading,
    error,
    signIn,
    signOut,
    isAuthenticated: !!user
  };
}; 