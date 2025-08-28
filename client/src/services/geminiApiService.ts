// Gemini API Key Management Service

const API_BASE_URL = import.meta.env.VITE_GEMINI_API_KEY_FETCH || 'https://noe76r75ni.execute-api.us-west-2.amazonaws.com/api';

export interface ApiKeyResponse {
  status: string;
  data: {
    api_key: string;
    created_at: string;
    updated_at: string;
  };
}

export interface ApiKeyError {
  status: string;
  message?: string;
  error?: string;
}

/**
 * Fetch the Gemini API key for a user by email
 */
export const fetchGeminiApiKey = async (userEmail: string): Promise<string | null> => {
  try {
    const encodedEmail = encodeURIComponent(userEmail);
    const response = await fetch(`${API_BASE_URL}/api-key/${encodedEmail}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data: ApiKeyResponse = await response.json();
      if (data.status === 'success' && data.data?.api_key) {
        return data.data.api_key;
      }
    }
    
    // If response is not ok or no API key found, return null
    return null;
  } catch (error) {
    console.error('Error fetching Gemini API key:', error);
    return null;
  }
};

/**
 * Save a Gemini API key for a user
 */
export const saveGeminiApiKey = async (userEmail: string, apiKey: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userEmail,
        api_key: apiKey,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.status === 'success';
    }
    
    return false;
  } catch (error) {
    console.error('Error saving Gemini API key:', error);
    return false;
  }
};

/**
 * Delete/clear a Gemini API key for a user by saving an empty string
 */
export const clearGeminiApiKey = async (userEmail: string): Promise<boolean> => {
  return saveGeminiApiKey(userEmail, '');
};

/**
 * Test if a Gemini API key is valid
 */
export const validateGeminiApiKey = async (apiKey: string): Promise<boolean> => {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`, {
      method: 'GET',
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error validating Gemini API key:', error);
    return false;
  }
};
