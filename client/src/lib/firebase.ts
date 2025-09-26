// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCTtWOFgT2EbdrofG54HPBKyWdx6pthbVo",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "sparrow-interviews.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "sparrow-interviews",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "sparrow-interviews.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "793112581997",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:793112581997:web:212218f06871ef1ad26c64"
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
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ;

// Cache for authorization results to avoid repeated API calls
const authorizationCache = new Map<string, { authorized: boolean; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Note: This function is no longer used - all emails are now allowed
const checkEmailAuthorization = async (email: string): Promise<boolean> => {
  // Check cache first
  const cached = authorizationCache.get(email);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.authorized;
  }

  try {
    // Import and use authenticated API service
    const { AuthenticatedApiService } = await import('./authenticatedApiService');
    
    console.log('🔍 Firebase: Checking email authorization with Firebase auth for:', email);
    const data = await AuthenticatedApiService.checkAuthorization(email);
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

// Email domain validation - now allows all emails
export const isAuthorizedEmail = async (email: string | null): Promise<boolean> => {
  if (!email) return false;
  
  // Allow all emails - no domain restrictions
  return true;
};

// Google Sign In with Popup (works for all environments)
export const signInWithGoogle = async () => {
  try {
    // Always use popup flow for better user experience and reliability
    console.log('🚀 Starting Google sign-in with popup');
    
    const result = await signInWithPopup(auth, googleProvider);
    console.log('✅ Google sign-in successful for:', result.user.email);
    
    // Check authorization immediately for popup flow
    const authorized = await isAuthorizedEmail(result.user.email);
    if (!authorized) {
      console.log('❌ User not authorized:', result.user.email);
      await signOut(auth);
      throw new Error('User not authorized.');
    }
    
    // Get the ID token for API calls
    try {
      const idToken = await result.user.getIdToken();
      console.log('✅ Firebase ID token obtained for API authentication');
      // Token will be stored by useAuth hook
    } catch (tokenError) {
      console.error('❌ Failed to get ID token:', tokenError);
      // Continue with sign-in even if token fails initially
    }
    
    console.log('✅ User authorized and signed in successfully');
    return result.user;
  } catch (error: any) {
    console.error("❌ Error during Google sign-in:", error);
    
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