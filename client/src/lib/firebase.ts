// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
  // Ensure popup works properly in all environments
  display: 'popup'
});

// Add scopes if needed
googleProvider.addScope('email');
googleProvider.addScope('profile');

// API endpoint for authorization check
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://kl85uizp68.execute-api.us-west-2.amazonaws.com/api';

// Cache for authorization results to avoid repeated API calls
const authorizationCache = new Map<string, { authorized: boolean; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Check authorization via API for non-@surveysparrow.com emails
const checkEmailAuthorization = async (email: string): Promise<boolean> => {
  // Check cache first
  const cached = authorizationCache.get(email);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.authorized;
  }

  try {
    // Send email directly without URL encoding the @ symbol
    const response = await fetch(`${API_BASE_URL}/check-authorization/${email}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Authorization check failed: ${response.status}`);
    }

    const data = await response.json();
    const authorized = data.authorized === true;
    
    // Cache the result
    authorizationCache.set(email, { authorized, timestamp: Date.now() });
    
    return authorized;
  } catch (error) {
    console.error('Error checking email authorization:', error);
    // If API fails, deny access for non-surveysparrow emails
    return false;
  }
};

// Email domain validation with API fallback
export const isAuthorizedEmail = async (email: string | null): Promise<boolean> => {
  if (!email) return false;
  
  // If it's a surveysparrow.com email, allow immediately
  if (email.endsWith('@surveysparrow.com')) {
    return true;
  }
  
  // For other domains, check via API
  return await checkEmailAuthorization(email);
};

// Google Sign In with Popup (works for all environments)
export const signInWithGoogle = async () => {
  try {
    // Always use popup flow for better user experience and reliability
    
    const result = await signInWithPopup(auth, googleProvider);
    
    
    // Check authorization immediately for popup flow
    const authorized = await isAuthorizedEmail(result.user.email);
    if (!authorized) {
      
      await signOut(auth);
      throw new Error('User not authorized.');
    }
    
    
    return result.user;
  } catch (error: any) {
    console.error("Error starting Google sign-in:", error);
    
    // Provide more helpful error messages
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in was cancelled. Please try again.');
    } else if (error.code === 'auth/popup-blocked') {
      throw new Error('Popup was blocked by your browser. Please allow popups for this site and try again.');
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('Network error. Please check your connection and try again.');
    }
    
    throw error;
  }
};



// Sign Out
export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};

export default app; 