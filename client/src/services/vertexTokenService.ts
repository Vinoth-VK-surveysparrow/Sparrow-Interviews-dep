// Vertex AI Dynamic Token Service
// Fetches short-lived tokens for Vertex AI Live API

import { getStoredFirebaseToken } from '@/lib/authenticatedApiService';

const TOKEN_API_URL = 'https://fsuh0ytlib.execute-api.us-west-2.amazonaws.com/api/generate-token';

export interface VertexTokenResponse {
  success: boolean;
  access_token: string;
  token_type: string;
  expires_in: number;
  project_id: string;
  model_id: string;
  expiry_time: string;
  cache_expiry_time: string;
  generated_at: string;
  cached: boolean;
}

export interface VertexTokenError {
  success: false;
  error: string;
  message?: string;
}

/**
 * Fetch a dynamic Vertex AI access token
 */
export const fetchVertexToken = async (): Promise<VertexTokenResponse | null> => {
  try {
    console.log('🔑 Fetching Vertex AI access token...');
    
    // Get Firebase token for authentication
    const firebaseToken = getStoredFirebaseToken();
    if (!firebaseToken) {
      console.error('❌ No Firebase token available for authentication');
      return null;
    }
    
    const response = await fetch(TOKEN_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${firebaseToken}`,
      },
      body: JSON.stringify({
        model_id: "gemini-live-2.5-flash-preview-native-audio-09-2025"
      }),
    });

    if (!response.ok) {
      console.error('❌ Token API request failed:', response.status, response.statusText);
      return null;
    }

    const data: VertexTokenResponse | VertexTokenError = await response.json();
    
    if (!data.success) {
      console.error('❌ Token generation failed:', (data as VertexTokenError).error);
      return null;
    }

    const tokenData = data as VertexTokenResponse;
    console.log('✅ Vertex AI token fetched successfully');
    console.log('📋 Token info:', {
      project_id: tokenData.project_id,
      model_id: tokenData.model_id,
      expires_in: tokenData.expires_in,
      cached: tokenData.cached
    });

    return tokenData;
  } catch (error) {
    console.error('❌ Error fetching Vertex AI token:', error);
    return null;
  }
};

/**
 * Check if a token is expired or about to expire (within 5 minutes)
 */
export const isTokenExpired = (tokenData: VertexTokenResponse): boolean => {
  try {
    const expiryTime = new Date(tokenData.expiry_time);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes buffer
    
    return expiryTime <= fiveMinutesFromNow;
  } catch (error) {
    console.error('Error checking token expiry:', error);
    return true; // Assume expired if we can't parse the date
  }
};

/**
 * Get the WebSocket URL for Vertex AI Live API with token
 */
export const getVertexWebSocketUrlWithToken = (token: string): string => {
  // Use the direct Vertex AI WebSocket endpoint with the token
  const location = 'us-central1';
  return `wss://${location}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;
};

/**
 * Get the model name from token response
 */
export const getModelFromToken = (tokenData: VertexTokenResponse): string => {
  // Use the model_id from the token response, but format it properly for Vertex AI
  return `projects/${tokenData.project_id}/locations/us-central1/publishers/google/models/${tokenData.model_id}`;
};

/**
 * Token cache management
 */
class TokenCache {
  private static instance: TokenCache;
  private cachedToken: VertexTokenResponse | null = null;

  static getInstance(): TokenCache {
    if (!TokenCache.instance) {
      TokenCache.instance = new TokenCache();
    }
    return TokenCache.instance;
  }

  async getValidToken(): Promise<VertexTokenResponse | null> {
    // Check if we have a cached token that's still valid
    if (this.cachedToken && !isTokenExpired(this.cachedToken)) {
      console.log('🔄 Using cached Vertex AI token');
      return this.cachedToken;
    }

    // Fetch a new token
    console.log('🆕 Fetching new Vertex AI token');
    const newToken = await fetchVertexToken();
    
    if (newToken) {
      this.cachedToken = newToken;
    }
    
    return newToken;
  }

  clearCache(): void {
    console.log('🗑️ Clearing Vertex AI token cache');
    this.cachedToken = null;
  }
}

export const tokenCache = TokenCache.getInstance();
