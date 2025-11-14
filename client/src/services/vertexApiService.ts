// Vertex AI Multimodal Live API Service
// Uses dynamic token fetching for authentication

export interface VertexCredentials {
  projectId: string;
  location: string;
  serviceAccountKey?: string;
}

/**
 * Get Vertex AI credentials from environment variables
 */
export const getVertexCredentials = (): VertexCredentials | null => {
  try {
    // Use hardcoded project ID as specified
    const projectId = 'sparrow-ml-staging';
    const location = import.meta.env.VITE_GOOGLE_CLOUD_LOCATION || import.meta.env.VITE_GEMINI_LOCATION || 'us-central1';
    const serviceAccountKey = import.meta.env.VITE_GOOGLE_APPLICATION_CREDENTIALS || import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_KEY;

    return {
      projectId,
      location,
      serviceAccountKey
    };
  } catch (error) {
    console.error('Error getting Vertex AI credentials from environment:', error);
    return null;
  }
};

/**
 * Validate environment variables are properly set
 * For dynamic token mode, we just need to be able to reach the token API
 */
export const validateEnvironmentSetup = (): boolean => {
  // For dynamic token mode, we always return true since we use the token API
  // The actual validation happens when we try to fetch the token
  return true;
};

/**
 * Get the WebSocket URL for direct Vertex AI Live API connection
 */
export const getVertexWebSocketUrl = (): string => {
  // Direct connection to Vertex AI WebSocket endpoint
  const location = 'us-central1';
  return `wss://${location}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;
};

/**
 * Get the Vertex AI model name
 * For dynamic token mode, this will be overridden by the token response
 */
export const getVertexModel = (): string => {
  // For dynamic token mode, we use the model from the token API response
  // This is just a fallback in case the token doesn't provide a model
  return 'gemini-2.5-pro';
};

/**
 * Generate setup instructions for dynamic token mode
 */
export const generateEnvironmentSetupInstructions = (): string => {
  return `Vertex AI is configured with dynamic tokens:

Project ID: sparrow-ml-staging
Location: us-central1
Model: gemini-live-2.5-flash-preview-native-audio-09-2025

Authentication:
- Uses dynamic token API for authentication
- Tokens are fetched automatically when needed
- No environment variables required

Token API: https://fsuh0ytlib.execute-api.us-west-2.amazonaws.com/api/generate-token`;
};

/**
 * Legacy functions for backwards compatibility - now just return environment-based values
 */
export const fetchVertexCredentials = async (userEmail?: string): Promise<VertexCredentials | null> => {
  console.warn('fetchVertexCredentials is deprecated. Using environment variables instead.');
  return getVertexCredentials();
};

export const saveVertexCredentials = async (
  userEmail: string, 
  accessToken: string, 
  projectId: string
): Promise<boolean> => {
  console.warn('saveVertexCredentials is deprecated. Use environment variables instead.');
  return false;
};

export const clearVertexCredentials = async (userEmail: string): Promise<boolean> => {
  console.warn('clearVertexCredentials is deprecated. Use environment variables instead.');
  return false;
};

export const validateVertexCredentials = async (
  accessToken?: string, 
  projectId?: string
): Promise<boolean> => {
  console.warn('validateVertexCredentials is deprecated. Using environment setup validation instead.');
  return validateEnvironmentSetup();
};

export const generateAccessTokenInstructions = generateEnvironmentSetupInstructions;
