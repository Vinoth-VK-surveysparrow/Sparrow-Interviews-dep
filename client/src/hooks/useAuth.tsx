import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGoogle, signOutUser, isAuthorizedEmail } from '@/lib/firebase';
import { fetchGeminiApiKey } from '@/services/geminiApiService';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState<string | null>(null);

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
            
            // Fetch the Gemini API key for the authorized user
            if (user.email) {
              try {
                const apiKey = await fetchGeminiApiKey(user.email);
                setGeminiApiKey(apiKey);
              } catch (error) {
                console.error('Error fetching Gemini API key:', error);
                setGeminiApiKey(null);
              }
            }
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
        setGeminiApiKey(null);
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
      setGeminiApiKey(null);
    } catch (error: any) {
      setError(error.message || 'An error occurred during sign out');
    } finally {
      setLoading(false);
    }
  };

  // Function to refresh the API key (useful after updates in settings)
  const refreshGeminiApiKey = async () => {
    if (user?.email) {
      try {
        const apiKey = await fetchGeminiApiKey(user.email);
        setGeminiApiKey(apiKey);
        return apiKey;
      } catch (error) {
        console.error('Error refreshing Gemini API key:', error);
        setGeminiApiKey(null);
        return null;
      }
    }
    return null;
  };

  // Listen for storage events to refresh API key when updated in other components
  useEffect(() => {
    const handleStorageChange = () => {
      if (user?.email) {
        refreshGeminiApiKey();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user?.email]);

  return {
    user,
    loading,
    error,
    signIn,
    signOut,
    geminiApiKey,
    refreshGeminiApiKey,
    isAuthenticated: !!user,
    hasGeminiApiKey: !!geminiApiKey
  };
}; 