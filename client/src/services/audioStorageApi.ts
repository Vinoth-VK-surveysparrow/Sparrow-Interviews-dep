import { S3Service } from '../lib/s3Service';

export interface SaveSessionResponse {
  success: boolean;
  sessionId: string;
  audioFileId?: string;
  message?: string;
}

export interface SessionMetadata {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  scenario: string;
  industry?: string;
  persona?: string;
  aiRole?: string;
  userAudioFileId?: string;
  aiAudioFileId?: string;
  mergedAudioFileId?: string;
  userAudioSize?: number;
  aiAudioSize?: number;
  totalSize?: number;
}

export interface UploadAudioRequest {
  audioBlob: Blob;
  metadata: {
    sessionId: string;
    scenario: string;
    audioType: 'user' | 'ai' | 'merged';
    industry?: string;
    persona?: string;
    aiRole?: string;
  };
}

export class AudioStorageApi {
  private userEmail: string;

  constructor(userEmail: string) {
    this.userEmail = userEmail;
  }

  /**
   * Upload audio file to S3 and save metadata
   */
  async uploadAudioFile(request: UploadAudioRequest): Promise<SaveSessionResponse> {
    try {
      console.log('📤 Uploading audio file:', {
        size: request.audioBlob.size,
        type: request.metadata.audioType,
        sessionId: request.metadata.sessionId
      });

      // Generate unique file ID
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const audioFileId = `${this.userEmail}/${request.metadata.sessionId}/${request.metadata.audioType}-${timestamp}.wav`;

      // Get presigned URL for upload
      const uploadResponse = await this.getPresignedUploadUrl(audioFileId);
      
      if (!uploadResponse.success) {
        throw new Error(uploadResponse.message || 'Failed to get presigned URL');
      }

      // Upload to S3
      const uploadResult = await this.uploadToS3(
        uploadResponse.presignedUrl!,
        request.audioBlob,
        uploadResponse.fields
      );

      if (!uploadResult.success) {
        throw new Error('Failed to upload to S3');
      }

      // Save metadata
      await this.saveAudioMetadata({
        audioFileId,
        userEmail: this.userEmail,
        sessionId: request.metadata.sessionId,
        scenario: request.metadata.scenario,
        audioType: request.metadata.audioType,
        fileSize: request.audioBlob.size,
        uploadedAt: new Date(),
        industry: request.metadata.industry,
        persona: request.metadata.persona,
        aiRole: request.metadata.aiRole
      });

      console.log('✅ Audio file uploaded successfully:', audioFileId);

      return {
        success: true,
        sessionId: request.metadata.sessionId,
        audioFileId,
        message: 'Audio uploaded successfully'
      };

    } catch (error) {
      console.error('🚨 Error uploading audio file:', error);
      return {
        success: false,
        sessionId: request.metadata.sessionId,
        message: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * Get all sessions for the user
   */
  async getAllSessions(): Promise<SessionMetadata[]> {
    try {
      console.log('📋 Fetching all sessions for user:', this.userEmail);

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/get-audio-sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_email: this.userEmail
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.sessions) {
        return data.sessions.map((session: any) => ({
          ...session,
          startTime: new Date(session.startTime),
          endTime: session.endTime ? new Date(session.endTime) : undefined
        }));
      }

      return [];
    } catch (error) {
      console.error('🚨 Error fetching sessions:', error);
      return [];
    }
  }

  /**
   * Download audio file from S3
   */
  async downloadAudioFile(audioFileId: string): Promise<Blob> {
    try {
      console.log('⬇️ Downloading audio file:', audioFileId);

      const downloadResponse = await this.getPresignedDownloadUrl(audioFileId);
      
      if (!downloadResponse.success) {
        throw new Error(downloadResponse.message || 'Failed to get download URL');
      }

      const response = await fetch(downloadResponse.presignedUrl!);
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      const blob = await response.blob();
      console.log('✅ Audio file downloaded:', blob.size, 'bytes');
      
      return blob;
    } catch (error) {
      console.error('🚨 Error downloading audio file:', error);
      return new Blob([], { type: 'audio/wav' });
    }
  }

  /**
   * Delete session and associated audio files
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting session:', sessionId);

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/delete-audio-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_email: this.userEmail,
          session_id: sessionId
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to delete session');
      }

      console.log('✅ Session deleted successfully');
    } catch (error) {
      console.error('🚨 Error deleting session:', error);
      throw error;
    }
  }

  /**
   * Verify audio upload
   */
  async verifyUpload(audioFileId: string): Promise<boolean> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/verify-audio-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_email: this.userEmail,
          audio_file_id: audioFileId
        }),
      });

      const data = await response.json();
      return data.success && data.exists;
    } catch (error) {
      console.error('🚨 Error verifying upload:', error);
      return false;
    }
  }

  // Private helper methods

  private async getPresignedUploadUrl(audioFileId: string): Promise<{
    success: boolean;
    presignedUrl?: string;
    fields?: Record<string, string>;
    message?: string;
  }> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/get-audio-upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_email: this.userEmail,
          audio_file_id: audioFileId,
          content_type: 'audio/wav'
        }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('🚨 Error getting presigned upload URL:', error);
      return {
        success: false,
        message: 'Failed to get upload URL'
      };
    }
  }

  private async getPresignedDownloadUrl(audioFileId: string): Promise<{
    success: boolean;
    presignedUrl?: string;
    message?: string;
  }> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/get-audio-download-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_email: this.userEmail,
          audio_file_id: audioFileId
        }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('🚨 Error getting presigned download URL:', error);
      return {
        success: false,
        message: 'Failed to get download URL'
      };
    }
  }

  private async uploadToS3(
    presignedUrl: string,
    audioBlob: Blob,
    fields?: Record<string, string>
  ): Promise<{ success: boolean; message?: string }> {
    try {
      let response: Response;

      if (fields) {
        // POST form upload
        const formData = new FormData();
        Object.entries(fields).forEach(([key, value]) => {
          formData.append(key, value);
        });
        formData.append('file', audioBlob);

        response = await fetch(presignedUrl, {
          method: 'POST',
          body: formData,
        });
      } else {
        // PUT upload
        response = await fetch(presignedUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'audio/wav',
          },
          body: audioBlob,
        });
      }

      if (!response.ok) {
        throw new Error(`S3 upload failed: ${response.status} ${response.statusText}`);
      }

      return { success: true };
    } catch (error) {
      console.error('🚨 S3 upload error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  private async saveAudioMetadata(metadata: {
    audioFileId: string;
    userEmail: string;
    sessionId: string;
    scenario: string;
    audioType: string;
    fileSize: number;
    uploadedAt: Date;
    industry?: string;
    persona?: string;
    aiRole?: string;
  }): Promise<void> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/save-audio-metadata`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
      });

      if (!response.ok) {
        throw new Error(`Failed to save metadata: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to save metadata');
      }
    } catch (error) {
      console.error('🚨 Error saving audio metadata:', error);
      throw error;
    }
  }
}

// Create a singleton instance factory
export const createAudioStorageApi = (userEmail: string): AudioStorageApi => {
  return new AudioStorageApi(userEmail);
};
