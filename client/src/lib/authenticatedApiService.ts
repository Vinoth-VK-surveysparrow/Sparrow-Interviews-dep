import { auth } from '@/lib/firebase';

// Token refresh interval (45 minutes = 2700000 ms)
let tokenRefreshInterval: NodeJS.Timeout | null = null;

// Helper function to get Firebase ID token
export const getFirebaseIdToken = async (): Promise<string> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No authenticated user found');
  }
  
  try {
    // Get fresh token (force refresh if needed)
    const idToken = await user.getIdToken(true);
    return idToken;
  } catch (error) {
    console.error('❌ Failed to get Firebase ID token:', error);
    throw new Error('Failed to get authentication token');
  }
};

// Store token in localStorage with timestamp for expiry checking
export const storeFirebaseToken = (token: string): void => {
  const tokenData = {
    token,
    timestamp: Date.now()
  };
  localStorage.setItem('firebaseToken', JSON.stringify(tokenData));
  console.log('✅ Firebase token stored with timestamp');
};

// Get stored token from localStorage and check if it's expired
export const getStoredFirebaseToken = (): string | null => {
  try {
    const tokenDataStr = localStorage.getItem('firebaseToken');
    if (!tokenDataStr) return null;
    
    const tokenData = JSON.parse(tokenDataStr);
    const now = Date.now();
    const tokenAge = now - tokenData.timestamp;
    
    // Firebase tokens expire after 1 hour (3600000 ms)
    // Refresh proactively if token is older than 50 minutes (3000000 ms)
    if (tokenAge > 3000000) {
      console.log('🔄 Token is getting old, will refresh proactively');
      return null; // Return null to trigger refresh
    }
    
    return tokenData.token;
  } catch (error) {
    console.error('❌ Error parsing stored token:', error);
    return null;
  }
};

// Clear stored token
export const clearStoredFirebaseToken = (): void => {
  localStorage.removeItem('firebaseToken');
  console.log('🗑️ Firebase token cleared');
  
  // Clear the background refresh interval
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
    tokenRefreshInterval = null;
    console.log('🗑️ Token refresh interval cleared');
  }
};

// Start background token refresh
export const startTokenRefresh = (): void => {
  // Clear any existing interval
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
  }
  
  // Refresh token every 45 minutes
  tokenRefreshInterval = setInterval(async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        console.log('🔄 Background token refresh...');
        const freshToken = await user.getIdToken(true); // Force refresh
        storeFirebaseToken(freshToken);
        console.log('✅ Background token refresh successful');
      }
    } catch (error) {
      console.error('❌ Background token refresh failed:', error);
    }
  }, 2700000); // 45 minutes
  
  console.log('✅ Background token refresh started (every 45 minutes)');
};

// Stop background token refresh
export const stopTokenRefresh = (): void => {
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
    tokenRefreshInterval = null;
    console.log('🛑 Background token refresh stopped');
  }
};

// Check and refresh token when page becomes visible (user returns to tab)
export const handleVisibilityChange = async (): Promise<void> => {
  if (document.visibilityState === 'visible') {
    try {
      const user = auth.currentUser;
      if (user) {
        const storedToken = getStoredFirebaseToken();
        if (!storedToken) {
          // Token is old or missing, refresh it
          console.log('🔄 Page became visible, refreshing token...');
          const freshToken = await user.getIdToken(true);
          storeFirebaseToken(freshToken);
          console.log('✅ Token refreshed on page visibility');
        }
      }
    } catch (error) {
      console.error('❌ Failed to refresh token on visibility change:', error);
    }
  }
};

// Initialize page visibility listener
export const initializeVisibilityListener = (): void => {
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    console.log('✅ Page visibility listener initialized');
  }
};

// Remove page visibility listener
export const removeVisibilityListener = (): void => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    console.log('🗑️ Page visibility listener removed');
  }
};

// Refresh token and retry failed request
const refreshTokenAndRetry = async (url: string, options: RequestInit): Promise<Response> => {
  try {
    console.log('🔄 Token expired, refreshing...');
    const newToken = await getFirebaseIdToken();
    storeFirebaseToken(newToken);
    
    // Update the Authorization header with new token
    const updatedHeaders = {
      ...options.headers,
      'Authorization': `Bearer ${newToken}`
    };
    
    // Retry the original request with new token
    return await fetch(url, {
      ...options,
      headers: updatedHeaders
    });
  } catch (error) {
    console.error('❌ Token refresh failed:', error);
    clearStoredFirebaseToken();
    // Redirect to login or throw error
    throw new Error('Authentication failed. Please sign in again.');
  }
};

// Main authenticated fetch function
export const authenticatedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  let token = getStoredFirebaseToken();
  
  // If no token or token is old, get a fresh one
  if (!token) {
    try {
      console.log('🔄 Getting fresh Firebase token...');
      token = await getFirebaseIdToken();
      storeFirebaseToken(token);
    } catch (error) {
      console.error('❌ Failed to get authentication token:', error);
      throw new Error('No authentication token available. Please sign in.');
    }
  }
  
  // Prepare headers with authentication
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers
  };
  
  try {
    // Make the authenticated request
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    // Handle token expiration (401 Unauthorized)
    if (response.status === 401) {
      console.log('🔄 Received 401, attempting token refresh...');
      return await refreshTokenAndRetry(url, options);
    }
    
    return response;
    
  } catch (error) {
    console.error('❌ Authenticated API call failed:', error);
    throw error;
  }
};

// Convenience function for JSON responses
export const authenticatedFetchJson = async <T = any>(url: string, options: RequestInit = {}): Promise<T> => {
  const response = await authenticatedFetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ API Error (${response.status}):`, errorText);
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
};

// Base API service class with Firebase authentication
export class AuthenticatedApiService {
  private static readonly API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  // GET assessments
  static async getAssessments(): Promise<any> {
    try {
      console.log('🔍 Fetching assessments with authentication');
      
      const data = await authenticatedFetchJson(`${this.API_BASE_URL}/assessments`);
      console.log('✅ Assessments fetched with auth:', data);
      
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch authenticated assessments:', error);
      throw error;
    }
  }

  // POST fetch questions
  static async fetchQuestions(request: any): Promise<any> {
    try {
      console.log('🔍 Fetching questions with authentication:', request);
      
      const data = await authenticatedFetchJson(`${this.API_BASE_URL}/fetch-questions`, {
        method: 'POST',
        body: JSON.stringify(request)
      });
      
      console.log('✅ Questions fetched with auth:', data);
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch authenticated questions:', error);
      throw error;
    }
  }

  // POST initiate assessment
  static async initiateAssessment(request: any): Promise<any> {
    try {
      console.log('🔍 Initiating assessment with authentication:', request);
      
      const data = await authenticatedFetchJson(`${this.API_BASE_URL}/assessment-responses/initiate`, {
        method: 'POST',
        body: JSON.stringify(request)
      });
      
      console.log('✅ Assessment initiated with auth:', data);
      return data;
    } catch (error) {
      console.error('❌ Failed to initiate authenticated assessment:', error);
      throw error;
    }
  }

  // POST get audio download URL
  static async getAudioDownloadUrl(request: any): Promise<any> {
    try {
      console.log('🔍 Getting audio download URL with authentication:', request);
      
      const data = await authenticatedFetchJson(`${this.API_BASE_URL}/assessment-responses/audio-download`, {
        method: 'POST',
        body: JSON.stringify(request)
      });
      
      console.log('✅ Audio download URL fetched with auth:', data);
      return data;
    } catch (error) {
      console.error('❌ Failed to get authenticated audio download URL:', error);
      throw error;
    }
  }

  // POST upload logs
  static async uploadLogs(request: any): Promise<any> {
    try {
      console.log('🔍 Uploading logs with authentication:', request);
      
      const data = await authenticatedFetchJson(`${this.API_BASE_URL}/log-upload`, {
        method: 'POST',
        body: JSON.stringify(request)
      });
      
      console.log('✅ Logs uploaded with auth:', data);
      return data;
    } catch (error) {
      console.error('❌ Failed to upload authenticated logs:', error);
      throw error;
    }
  }

  // POST verify audio
  static async verifyAudio(request: any): Promise<any> {
    try {
      console.log('🔍 Verifying audio with authentication:', request);
      
      const data = await authenticatedFetchJson(`${this.API_BASE_URL}/verify-audio`, {
        method: 'POST',
        body: JSON.stringify(request)
      });
      
      console.log('✅ Audio verified with auth:', data);
      return data;
    } catch (error) {
      console.error('❌ Failed to verify authenticated audio:', error);
      throw error;
    }
  }

  // GET test assessments
  static async getTestAssessments(testId: string): Promise<any> {
    try {
      console.log('🔍 Fetching test assessments with authentication for test:', testId);
      
      const data = await authenticatedFetchJson(`${this.API_BASE_URL}/assessments/test/${testId}`);
      console.log('✅ Test assessments fetched with auth:', data);
      
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch authenticated test assessments:', error);
      throw error;
    }
  }

  // POST next assessment
  static async getNextAssessment(request: any): Promise<any> {
    try {
      console.log('🔍 Getting next assessment with authentication:', request);
      
      const data = await authenticatedFetchJson(`${this.API_BASE_URL}/next-assessment`, {
        method: 'POST',
        body: JSON.stringify(request)
      });
      
      console.log('✅ Next assessment fetched with auth:', data);
      return data;
    } catch (error) {
      console.error('❌ Failed to get authenticated next assessment:', error);
      throw error;
    }
  }

  // POST check test availability
  static async checkTestAvailability(testId: string, request: any): Promise<any> {
    try {
      console.log('🔍 Checking test availability with authentication:', { testId, request });
      
      const data = await authenticatedFetchJson(`${this.API_BASE_URL}/assessments/test-available/${testId}`, {
        method: 'POST',
        body: JSON.stringify(request)
      });
      
      console.log('✅ Test availability checked with auth:', data);
      return data;
    } catch (error) {
      console.error('❌ Failed to check authenticated test availability:', error);
      throw error;
    }
  }

  // GET user tests
  static async getUserTests(userEmail: string): Promise<any> {
    try {
      console.log('🔍 Fetching user tests with authentication for:', userEmail);
      
      const data = await authenticatedFetchJson(`${this.API_BASE_URL}/users/${userEmail}/tests`);
      console.log('✅ User tests fetched with auth:', data);
      
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch authenticated user tests:', error);
      throw error;
    }
  }

  // GET user answers
  static async getUserAnswers(request: any): Promise<any> {
    try {
      console.log('🔍 Fetching user answers with authentication:', request);
      
      const data = await authenticatedFetchJson(`${this.API_BASE_URL}/get-answers`, {
        method: 'POST',
        body: JSON.stringify(request)
      });
      
      console.log('✅ User answers fetched with auth:', data);
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch authenticated user answers:', error);
      throw error;
    }
  }

  // GET check authorization
  static async checkAuthorization(email: string): Promise<any> {
    try {
      console.log('🔍 Checking authorization with authentication for:', email);
      
      const data = await authenticatedFetchJson(`${this.API_BASE_URL}/check-authorization/${email}`);
      console.log('✅ Authorization checked with auth:', data);
      
      return data;
    } catch (error) {
      console.error('❌ Failed to check authenticated authorization:', error);
      throw error;
    }
  }

  // POST get audio sessions
  static async getAudioSessions(request: any): Promise<any> {
    try {
      console.log('🔍 Getting audio sessions with authentication:', request);
      
      const data = await authenticatedFetchJson(`${this.API_BASE_URL}/get-audio-sessions`, {
        method: 'POST',
        body: JSON.stringify(request)
      });
      
      console.log('✅ Audio sessions fetched with auth:', data);
      return data;
    } catch (error) {
      console.error('❌ Failed to get authenticated audio sessions:', error);
      throw error;
    }
  }

  // POST delete audio session
  static async deleteAudioSession(request: any): Promise<any> {
    try {
      console.log('🔍 Deleting audio session with authentication:', request);
      
      const data = await authenticatedFetchJson(`${this.API_BASE_URL}/delete-audio-session`, {
        method: 'POST',
        body: JSON.stringify(request)
      });
      
      console.log('✅ Audio session deleted with auth:', data);
      return data;
    } catch (error) {
      console.error('❌ Failed to delete authenticated audio session:', error);
      throw error;
    }
  }

  // POST verify audio upload
  static async verifyAudioUpload(request: any): Promise<any> {
    try {
      console.log('🔍 Verifying audio upload with authentication:', request);
      
      const data = await authenticatedFetchJson(`${this.API_BASE_URL}/verify-audio-upload`, {
        method: 'POST',
        body: JSON.stringify(request)
      });
      
      console.log('✅ Audio upload verified with auth:', data);
      return data;
    } catch (error) {
      console.error('❌ Failed to verify authenticated audio upload:', error);
      throw error;
    }
  }

  // POST get audio upload URL
  static async getAudioUploadUrl(request: any): Promise<any> {
    try {
      console.log('🔍 Getting audio upload URL with authentication:', request);
      
      const data = await authenticatedFetchJson(`${this.API_BASE_URL}/get-audio-upload-url`, {
        method: 'POST',
        body: JSON.stringify(request)
      });
      
      console.log('✅ Audio upload URL fetched with auth:', data);
      return data;
    } catch (error) {
      console.error('❌ Failed to get authenticated audio upload URL:', error);
      throw error;
    }
  }

  // POST get audio download URL
  static async getAudioDownloadUrlFromStorage(request: any): Promise<any> {
    try {
      console.log('🔍 Getting audio download URL from storage with authentication:', request);
      
      const data = await authenticatedFetchJson(`${this.API_BASE_URL}/get-audio-download-url`, {
        method: 'POST',
        body: JSON.stringify(request)
      });
      
      console.log('✅ Audio download URL from storage fetched with auth:', data);
      return data;
    } catch (error) {
      console.error('❌ Failed to get authenticated audio download URL from storage:', error);
      throw error;
    }
  }

  // POST save audio metadata
  static async saveAudioMetadata(request: any): Promise<any> {
    try {
      console.log('🔍 Saving audio metadata with authentication:', request);
      
      const data = await authenticatedFetchJson(`${this.API_BASE_URL}/save-audio-metadata`, {
        method: 'POST',
        body: JSON.stringify(request)
      });
      
      console.log('✅ Audio metadata saved with auth:', data);
      return data;
    } catch (error) {
      console.error('❌ Failed to save authenticated audio metadata:', error);
      throw error;
    }
  }
}

// Admin API service class with Firebase authentication
export class AuthenticatedAdminApiService {
  private static readonly API_ADMIN_URL = import.meta.env.VITE_API_ADMIN_URL;

  // GET all tests
  static async getAllTests(): Promise<any> {
    try {
      console.log('🔍 Fetching all tests with authentication');
      
      const data = await authenticatedFetchJson(`${this.API_ADMIN_URL}/tests`);
      console.log('✅ All tests fetched with auth:', data);
      
      return data.tests || [];
    } catch (error) {
      console.error('❌ Failed to fetch authenticated tests:', error);
      throw error;
    }
  }

  // GET assessment progress for a specific test
  static async getAssessmentProgress(testId: string): Promise<any> {
    try {
      console.log('🔍 Fetching assessment progress with authentication for test:', testId);
      
      const data = await authenticatedFetchJson(`${this.API_ADMIN_URL}/assessment-progress/${testId}`);
      console.log('✅ Assessment progress fetched with auth:', data);
      
      return data.data.assessments || [];
    } catch (error) {
      console.error('❌ Failed to fetch authenticated assessment progress:', error);
      throw error;
    }
  }

  // GET users for a specific assessment
  static async getAssessmentUsers(assessmentId: string): Promise<any> {
    try {
      console.log('🔍 Fetching assessment users with authentication for assessment:', assessmentId);
      
      const data = await authenticatedFetchJson(`${this.API_ADMIN_URL}/assessment-users/${assessmentId}`);
      console.log('✅ Assessment users fetched with auth:', data);
      
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch authenticated assessment users:', error);
      throw error;
    }
  }

  // GET all users
  static async getAllUsers(): Promise<any> {
    try {
      console.log('🔍 Fetching all users with authentication');
      
      const data = await authenticatedFetchJson(`${this.API_ADMIN_URL}/all-users`);
      console.log('✅ All users fetched with auth:', data);
      
      return data.users || [];
    } catch (error) {
      console.error('❌ Failed to fetch authenticated users:', error);
      throw error;
    }
  }

  // GET user details by email
  static async getUserDetails(userEmail: string): Promise<any> {
    try {
      console.log('🔍 Fetching user details with authentication for:', userEmail);
      
      const data = await authenticatedFetchJson(`${this.API_ADMIN_URL}/user/${userEmail}`);
      console.log('✅ User details fetched with auth:', data);
      
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch authenticated user details:', error);
      throw error;
    }
  }

  // DELETE assessment
  static async deleteAssessment(userEmail: string, assessmentId: string): Promise<any> {
    try {
      console.log('🗑️ Deleting assessment with authentication:', { userEmail, assessmentId });
      
      const data = await authenticatedFetchJson(`${this.API_ADMIN_URL}/delete-assessment`, {
        method: 'DELETE',
        body: JSON.stringify({
          user_email: userEmail,
          assessment_id: assessmentId
        })
      });
      
      console.log('✅ Assessment deleted with auth:', data);
      return data;
    } catch (error) {
      console.error('❌ Failed to delete assessment with auth:', error);
      throw error;
    }
  }

  // DELETE test assessments
  static async deleteTestAssessments(testId: string, userEmail?: string): Promise<any> {
    try {
      console.log('🗑️ Deleting test assessments with authentication for test:', testId);
      
      const requestBody: any = { test_id: testId };
      if (userEmail) {
        requestBody.user_email = userEmail;
      }
      
      const data = await authenticatedFetchJson(`${this.API_ADMIN_URL}/delete-test-assessments`, {
        method: 'DELETE',
        body: JSON.stringify(requestBody)
      });
      
      console.log('✅ Test assessments deleted with auth:', data);
      return data;
    } catch (error) {
      console.error('❌ Failed to delete test assessments with auth:', error);
      throw error;
    }
  }
}
