import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGoogle, signOutUser, isAuthorizedEmail } from '@/lib/firebase';
import { getVertexCredentials, validateEnvironmentSetup, VertexCredentials } from '@/services/vertexApiService';
import { storeFirebaseToken, clearStoredFirebaseToken, startTokenRefresh, stopTokenRefresh, initializeVisibilityListener, removeVisibilityListener } from '@/lib/authenticatedApiService';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vertexCredentials, setVertexCredentials] = useState<VertexCredentials | null>(null);

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
            clearStoredFirebaseToken();
            stopTokenRefresh();
          } else {
            setUser(user);
            setError(null); // Clear any previous errors for authorized users
            
            // Store Firebase ID token for authenticated API calls
            try {
              const idToken = await user.getIdToken();
              storeFirebaseToken(idToken);
              console.log('✅ Firebase token stored for authenticated API calls');
              
              // Start background token refresh and visibility listener
              startTokenRefresh();
              initializeVisibilityListener();
            } catch (tokenError) {
              console.error('❌ Failed to get/store Firebase token:', tokenError);
            }
            
            // Get the Vertex AI credentials from environment variables
            try {
              const credentials = getVertexCredentials();
              setVertexCredentials(credentials);
            } catch (error) {
              console.error('Error getting Vertex AI credentials from environment:', error);
              setVertexCredentials(null);
            }
          }
        } catch (error) {
          console.error('Error checking user authorization:', error);
          // If authorization check fails, sign out for safety
          await signOutUser();
          setUser(null);
          setError('Authorization check failed. Please try again.');
          clearStoredFirebaseToken();
          stopTokenRefresh();
        }
      } else {
        setUser(null);
        setError(null);
        setVertexCredentials(null);
        clearStoredFirebaseToken();
        stopTokenRefresh();
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      // Cleanup token refresh and visibility listener on unmount
      stopTokenRefresh();
      removeVisibilityListener();
    };
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
      setVertexCredentials(null);
      clearStoredFirebaseToken();
      stopTokenRefresh();
      console.log('🚪 User signed out and token cleared');
    } catch (error: any) {
      setError(error.message || 'An error occurred during sign out');
    } finally {
      setLoading(false);
    }
  };

  // Function to refresh the Vertex AI credentials (useful after environment changes)
  const refreshVertexCredentials = async () => {
    try {
      const credentials = getVertexCredentials();
      setVertexCredentials(credentials);
      return credentials;
    } catch (error) {
      console.error('Error refreshing Vertex AI credentials:', error);
      setVertexCredentials(null);
      return null;
    }
  };

  // Listen for environment variable changes
  useEffect(() => {
    const handleCredentialsUpdate = () => {
      refreshVertexCredentials();
    };

    // Listen for environment changes
    window.addEventListener('vertex-credentials-updated', handleCredentialsUpdate);
    
    return () => {
      window.removeEventListener('vertex-credentials-updated', handleCredentialsUpdate);
    };
  }, []);

  return {
    user,
    loading,
    error,
    signIn,
    signOut,
    vertexCredentials,
    refreshVertexCredentials,
    isAuthenticated: !!user,
    hasVertexCredentials: !!vertexCredentials?.projectId && validateEnvironmentSetup()
  };
}; 