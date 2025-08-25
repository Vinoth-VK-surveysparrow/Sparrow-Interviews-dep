// Audio Upload Service using the AWS Chalice API
const AUDIO_API_BASE = import.meta.env.VITE_AUDIO_API_BASE;

export interface AudioUploadResponse {
  audio_id: string;
  upload_url: string;
  audio_key: string;
  expires_in: number;
}

export interface AudioUploadRequest {
  user_id: string;
  round_id: string;
  filename?: string;
  content_type?: string;
}

export interface AudioFileInfo {
  audio_id: string;
  download_url: string;
  audio_key: string;
  filename: string;
  size: number;
  last_modified: string;
  content_type: string;
  expires_in: number;
}

export interface AudioListResponse {
  files: Array<{
    audio_id: string;
    audio_key: string;
    user_id: string;
    round_id: string;
    filename: string;
    size: number;
    last_modified: string;
  }>;
  count: number;
  total_size: number;
}

export class AudioUploadService {
  /**
   * Step 1: Get a presigned upload URL
   */
  static async getUploadUrl(request: AudioUploadRequest): Promise<AudioUploadResponse> {
    const response = await fetch(`${AUDIO_API_BASE}/audio/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: request.user_id,
        round_id: request.round_id,
        filename: request.filename || 'audio',
        content_type: request.content_type || 'audio/webm'
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to get upload URL: ${response.status} - ${errorData.error || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Step 2: Upload the actual audio file to S3
   */
  static async uploadAudio(uploadUrl: string, audioBlob: Blob, contentType: string): Promise<void> {
    console.log('[AUDIO-UPLOAD] Uploading to S3 with URL:', uploadUrl.substring(0, 100) + '...');
    console.log('[AUDIO-UPLOAD] Content-Type:', contentType);
    console.log('[AUDIO-UPLOAD] Blob size:', audioBlob.size);
    
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: audioBlob,
    });

    console.log('[AUDIO-UPLOAD] S3 upload response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details');
      console.error('[AUDIO-UPLOAD] S3 upload failed:', {
        status: response.status,
        statusText: response.statusText,
        errorText
      });
      throw new Error(`Failed to upload audio: ${response.status} - ${response.statusText}`);
    }
    
    console.log('[AUDIO-UPLOAD] S3 upload successful');
  }

  /**
   * Complete upload process: get URL and upload file
   */
  static async uploadRecording(
    audioBlob: Blob, 
    userId: string, 
    assessmentType: string,
    assessmentId: string
  ): Promise<{ audio_id: string; audio_key: string }> {
    const maxRetries = 2;
    let lastError: Error = new Error('Unknown upload error');

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[AUDIO-UPLOAD] Upload attempt ${attempt}/${maxRetries} for user:`, userId);
        
        const filename = `${assessmentType}-${assessmentId}-${Date.now()}.webm`;
        const contentType = audioBlob.type || 'audio/webm';
        const roundId = `${assessmentType}-${assessmentId}`;

        // Step 1: Get presigned upload URL
        const uploadData = await this.getUploadUrl({
          user_id: userId,
          round_id: roundId,
          filename,
          content_type: contentType
        });

        console.log('[AUDIO-UPLOAD] Got upload URL, audio_id:', uploadData.audio_id);

        // Step 2: Upload the file
        await this.uploadAudio(uploadData.upload_url, audioBlob, contentType);

        console.log('[AUDIO-UPLOAD] File uploaded successfully');

        return {
          audio_id: uploadData.audio_id,
          audio_key: uploadData.audio_key
        };

      } catch (error) {
        lastError = error as Error;
        console.error(`[AUDIO-UPLOAD] Upload attempt ${attempt} failed:`, error);
        
        // If it's a 403 or 404 error, don't retry as it's likely a configuration issue
        if (error instanceof Error && (error.message.includes('403') || error.message.includes('400'))) {
          console.error('[AUDIO-UPLOAD] Client error - not retrying:', error.message);
          break;
        }
        
        if (attempt < maxRetries) {
          const delay = attempt * 1000; // Exponential backoff
          console.log(`[AUDIO-UPLOAD] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error('[AUDIO-UPLOAD] All upload attempts failed');
    throw lastError || new Error('Upload failed after all retries');
  }

  /**
   * Get audio file information including download URL
   */
  static async getAudioInfo(audioId: string, userId?: string, roundId?: string): Promise<AudioFileInfo> {
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);
    if (roundId) params.append('round_id', roundId);
    
    const queryString = params.toString();
    const url = `${AUDIO_API_BASE}/audio/${audioId}${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to get audio info: ${response.status} - ${errorData.error || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get download URL for an audio file
   */
  static async getDownloadUrl(audioId: string, userId?: string, roundId?: string): Promise<{ download_url: string; expires_in: number }> {
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);
    if (roundId) params.append('round_id', roundId);
    
    const queryString = params.toString();
    const url = `${AUDIO_API_BASE}/audio/${audioId}/download${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to get download URL: ${response.status} - ${errorData.error || response.statusText}`);
    }

    return response.json();
  }

  /**
   * List audio files for a user
   */
  static async listAudioFiles(userId: string, roundId?: string, limit = 100): Promise<AudioListResponse> {
    const params = new URLSearchParams();
    params.append('user_id', userId);
    if (roundId) params.append('round_id', roundId);
    params.append('limit', limit.toString());
    
    const response = await fetch(`${AUDIO_API_BASE}/audio/list?${params.toString()}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to list audio files: ${response.status} - ${errorData.error || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Delete an audio file
   */
  static async deleteAudio(audioId: string, userId?: string, roundId?: string): Promise<void> {
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);
    if (roundId) params.append('round_id', roundId);
    
    const queryString = params.toString();
    const url = `${AUDIO_API_BASE}/audio/${audioId}${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to delete audio: ${response.status} - ${errorData.error || response.statusText}`);
    }
  }

  /**
   * Health check for the audio service
   */
  static async healthCheck(): Promise<{ status: string; service: string; bucket: string; bucket_accessible: boolean }> {
    const response = await fetch(`${AUDIO_API_BASE}/health`);

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Utility method to create assessment round ID
   */
  static createRoundId(assessmentType: string, assessmentId: string): string {
    return `${assessmentType}-${assessmentId}`;
  }

  /**
   * Utility method to validate audio blob before upload
   */
  static validateAudioBlob(audioBlob: Blob): { valid: boolean; error?: string } {
    if (!audioBlob) {
      return { valid: false, error: 'Audio blob is null or undefined' };
    }

    if (audioBlob.size === 0) {
      return { valid: false, error: 'Audio blob is empty' };
    }

    if (audioBlob.size > 100 * 1024 * 1024) { // 100MB limit
      return { valid: false, error: 'Audio blob is too large (>100MB)' };
    }

    // Check if it's a supported audio type
    const supportedTypes = ['audio/webm', 'audio/mp3', 'audio/wav', 'audio/m4a'];
    if (audioBlob.type && !supportedTypes.some(type => audioBlob.type.includes(type.split('/')[1]))) {
      console.warn('[AUDIO-UPLOAD] Unsupported audio type:', audioBlob.type, 'but proceeding anyway');
    }

    return { valid: true };
  }
}

// Export for backwards compatibility
export default AudioUploadService;