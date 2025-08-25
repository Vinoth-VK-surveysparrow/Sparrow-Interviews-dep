const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export interface AssessmentInteraction {
  question: string;
  question_id?: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
}

export interface AssessmentLogs {
  session_start: string;
  user_agent?: string;
  interactions: AssessmentInteraction[];
  performance_metrics?: {
    loading_time?: number;
    recording_duration?: number;
  };
}

export interface InitiateAssessmentRequest {
  user_email: string;
  assessment_id: string;
  answered_at?: string;
  duration?: number;
  // Removed logs parameter - now handled separately
}

export interface InitiateAssessmentResponse {
  status?: string;
  message?: string;
  session_id?: string;
  audio_key?: string;
  audio?: {
    key: string;
    presigned_url: string;
  };
  images_upload?: {
    prefix: string;
    presigned_post: {
      url: string;
      fields: {
        key: string;
        [key: string]: string;
      };
    };
  };
}

export interface AudioDownloadRequest {
  user_email: string;
  assessment_id: string;
}

export interface AudioDownloadResponse {
  audio_download_url: string;
}

// Assessment-related interfaces
export interface Assessment {
  assessment_id: string;
  assessment_name: string;
  order: number;
  description: string;
  type?: string;
}

export interface AssessmentsResponse {
  assessments: Assessment[];
}

// Questions-related interfaces
export interface Question {
  question_id: string;
  question_text: string;
  order: number;
  type: string;
}

export interface FetchQuestionsRequest {
  user_email: string;
  assessment_id: string;
}

export interface FetchQuestionsResponse {
  questions?: Question[];
  status?: string;
  message?: string;
  completed_at?: string;
  audio_key?: string;
}

// Cache for assessments
interface AssessmentCache {
  data: Assessment[];
  timestamp: number;
  hash: string; // Hash of the response to detect changes
}

// Cache for completed assessments per user
interface CompletedAssessmentCache {
  [userEmail: string]: {
    [assessmentId: string]: {
      status: string;
      message: string;
      completed_at: string;
      audio_key?: string;
      timestamp: number;
    };
  };
}

export interface LogsUploadRequest {
  user_email: string;
  assessment_id: string;
  logs: AssessmentLogs;
}

export interface LogsUploadResponse {
  status: string;
  message: string;
  logs_key: string;
}

export interface AudioVerificationRequest {
  user_email: string;
  assessment_id: string;
}

export interface AudioVerificationResponse {
  status: string;
  message: string;
  data: {
    user_email: string;
    assessment_id: string;
    presence: boolean;
    audio_key?: string;
  };
}

export class S3Service {
  private static assessmentCache: AssessmentCache | null = null;
  private static completedAssessmentCache: CompletedAssessmentCache = {};
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
  private static readonly COMPLETION_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  static async initiateAssessment(request: InitiateAssessmentRequest): Promise<InitiateAssessmentResponse> {
    try {
      

      const response = await fetch(`${API_BASE_URL}/assessment-responses/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Initiate assessment error:', errorText);
        throw new Error(`Failed to initiate assessment: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error initiating assessment:', error);
      throw error;
    }
  }

  static async getAudioDownloadUrl(request: AudioDownloadRequest): Promise<AudioDownloadResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/assessment-responses/audio-download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Failed to get audio download URL: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting audio download URL:', error);
      throw error;
    }
  }

  static async uploadAudio(presignedUrl: string, audioBlob: Blob): Promise<void> {
    try {
      
      
      const response = await fetch(presignedUrl, {
        method: 'PUT',
        body: audioBlob,
        headers: {
          'Content-Type': audioBlob.type || 'audio/webm',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('S3 upload failed:', response.status, response.statusText, errorText);
        throw new Error(`Failed to upload audio: ${response.status} ${response.statusText}`);
      }
      
      
    } catch (error) {
      console.error('Error uploading audio:', error);
      throw error;
    }
  }

  static async uploadImage(presignedPost: any, imageBlob: Blob, filename: string): Promise<void> {
    try {
      
      
      
      

      const formData = new FormData();
      
      // CRITICAL: Determine the correct content type based on the file
      let contentType = imageBlob.type || 'image/jpeg';
      if (!contentType.startsWith('image/')) {
        // Fallback based on filename extension
        const ext = filename.toLowerCase().split('.').pop();
        switch (ext) {
          case 'png': contentType = 'image/png'; break;
          case 'jpg': case 'jpeg': contentType = 'image/jpeg'; break;
          case 'gif': contentType = 'image/gif'; break;
          case 'webp': contentType = 'image/webp'; break;
          default: contentType = 'image/jpeg';
        }
      }
      
      

      // IMPORTANT: Always add Content-Type first, even if not in presigned fields
      formData.append('Content-Type', contentType);
      

      // Add all other fields from the presigned POST
      Object.keys(presignedPost.fields).forEach(key => {
        if (key === 'key') {
          const keyValue = presignedPost.fields[key].replace('${filename}', filename);
          formData.append(key, keyValue);
          
        } else if (key !== 'Content-Type') {
          // Skip Content-Type if it's in presigned fields since we already added it
          formData.append(key, presignedPost.fields[key]);
          
        }
      });
      
      // Add the file last - this is crucial!
      formData.append('file', imageBlob, filename);
      
      
      
      

      const response = await fetch(presignedPost.url, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - browser will set multipart/form-data with boundary
      });

      
      

      if (!response.ok) {
        const errorText = await response.text();
        console.error('S3 upload error:', errorText);
        
        // Parse S3 XML error if available
        if (errorText.includes('<?xml')) {
          try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(errorText, 'text/xml');
            const errorCode = xmlDoc.getElementsByTagName('Code')[0]?.textContent;
            const errorMessage = xmlDoc.getElementsByTagName('Message')[0]?.textContent;
            console.error('S3 Error Code:', errorCode);
            console.error('S3 Error Message:', errorMessage);
            throw new Error(`S3 Error: ${errorCode} - ${errorMessage}`);
          } catch (parseError) {
            console.error('Could not parse S3 error XML');
          }
        }
        
        throw new Error(`Failed to upload image: ${response.status} ${response.statusText}`);
      }
      
      
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  static async uploadLogs(request: LogsUploadRequest): Promise<LogsUploadResponse> {
    try {
      

      const response = await fetch(`${API_BASE_URL}/log-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Logs upload error:', errorText);
        throw new Error(`Failed to upload logs: ${response.statusText}`);
      }

      const result = await response.json();
      
      return result;
    } catch (error) {
      console.error('Error uploading logs:', error);
      throw error;
    }
  }

  static async verifyAudio(request: AudioVerificationRequest): Promise<AudioVerificationResponse> {
    try {
      

      const response = await fetch(`${API_BASE_URL}/verify-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Audio verification error:', errorText);
        throw new Error(`Failed to verify audio: ${response.statusText}`);
      }

      const result = await response.json();
      
      return result;
    } catch (error) {
      console.error('Error verifying audio:', error);
      throw error;
    }
  }

  // Simple hash function for comparing responses
  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  static async getAssessments(): Promise<Assessment[]> {
    try {
      const now = Date.now();
      
      // Check if we have valid cache
      if (this.assessmentCache && (now - this.assessmentCache.timestamp) < this.CACHE_DURATION) {
        
        return this.assessmentCache.data;
      }

      
      
      const response = await fetch(`${API_BASE_URL}/assessments`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch assessments:', response.status, response.statusText, errorText);
        
        // If we have cached data and the API fails, return cached data
        if (this.assessmentCache) {
          
          return this.assessmentCache.data;
        }
        
        throw new Error(`Failed to fetch assessments: ${response.status} ${response.statusText}`);
      }

      const responseText = await response.text();
      const responseHash = this.hashString(responseText);
      
      // Check if response has changed compared to cache
      if (this.assessmentCache && this.assessmentCache.hash === responseHash) {
        
        this.assessmentCache.timestamp = now;
        return this.assessmentCache.data;
      }

      // Parse the response
      const data: AssessmentsResponse = JSON.parse(responseText);
      
      
      // Sort by order
      const sortedAssessments = data.assessments.sort((a, b) => a.order - b.order);
      
      // Update cache
      this.assessmentCache = {
        data: sortedAssessments,
        timestamp: now,
        hash: responseHash
      };
      
      if (this.assessmentCache.hash !== responseHash) {
        
      } else {
        
      }
      
      return sortedAssessments;
    } catch (error) {
      console.error('Error fetching assessments:', error);
      
      // If we have cached data and there's an error, return cached data
      if (this.assessmentCache) {
        
        return this.assessmentCache.data;
      }
      
      throw error;
    }
  }

  // Method to manually clear the cache if needed
  static clearAssessmentCache(): void {
    
    this.assessmentCache = null;
  }

  // Method to clear completion cache (for debugging)
  static clearCompletionCache(): void {
    
    this.completedAssessmentCache = {};
  }

  static async fetchQuestions(request: FetchQuestionsRequest): Promise<Question[]> {
    try {
      const now = Date.now();
      
      // Check completion cache first
      const userCache = this.completedAssessmentCache[request.user_email];
      if (userCache && userCache[request.assessment_id]) {
        const cachedCompletion = userCache[request.assessment_id];
        const cacheAge = now - cachedCompletion.timestamp;
        
        if (cacheAge < this.COMPLETION_CACHE_DURATION) {
          
          throw new Error(`ASSESSMENT_COMPLETED:${JSON.stringify(cachedCompletion)}`);
        }
      }
      
      
      
      const response = await fetch(`${API_BASE_URL}/fetch-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch questions:', response.status, response.statusText, errorText);
        throw new Error(`Failed to fetch questions: ${response.status} ${response.statusText}`);
      }

      const data: FetchQuestionsResponse = await response.json();
      
      // Check if assessment is already completed
      if (data.status === 'completed') {
        
        
        // Cache the completion status
        this.cacheCompletedAssessment(request.user_email, request.assessment_id, {
          status: data.status,
          message: data.message || 'Assessment completed',
          completed_at: data.completed_at || new Date().toISOString(),
          audio_key: data.audio_key,
          timestamp: now
        });
        
        throw new Error(`ASSESSMENT_COMPLETED:${JSON.stringify(data)}`);
      }
      
      if (!data.questions || data.questions.length === 0) {
        throw new Error('No questions returned from the API');
      }
      
      
      
      // Sort by order
      const sortedQuestions = data.questions.sort((a, b) => a.order - b.order);
      
      return sortedQuestions;
    } catch (error) {
      console.error('Error fetching questions:', error);
      throw error;
    }
  }

  // Cache completed assessment status
  private static cacheCompletedAssessment(userEmail: string, assessmentId: string, completionData: any): void {
    if (!this.completedAssessmentCache[userEmail]) {
      this.completedAssessmentCache[userEmail] = {};
    }
    
    this.completedAssessmentCache[userEmail][assessmentId] = completionData;
    
  }

  // Method to mark assessment as completed (call this after successful submission)
  static markAssessmentCompleted(userEmail: string, assessmentId: string): void {
    const now = Date.now();
    this.cacheCompletedAssessment(userEmail, assessmentId, {
      status: 'completed',
      message: 'Assessment completed successfully',
      completed_at: new Date().toISOString(),
      timestamp: now
    });
  }



  // Method to check if assessment is completed from cache
  static isAssessmentCompleted(userEmail: string, assessmentId: string): boolean {
    const userCache = this.completedAssessmentCache[userEmail];
    if (!userCache || !userCache[assessmentId]) {
      return false;
    }
    
    const cacheAge = Date.now() - userCache[assessmentId].timestamp;
    return cacheAge < this.COMPLETION_CACHE_DURATION;
  }

  // Check if an assessment is unlocked (previous assessments completed)
  static async isAssessmentUnlocked(userEmail: string, assessmentId: string): Promise<boolean> {
    try {
      const assessments = await this.getAssessments();
      
      // Find the target assessment
      const targetAssessment = assessments.find(a => a.assessment_id === assessmentId);
      if (!targetAssessment) {
        
        return false;
      }

      // First assessment (lowest order) is always unlocked
      const lowestOrder = Math.min(...assessments.map(a => a.order));
      if (targetAssessment.order === lowestOrder) {
        
        return true;
      }

      // Check if all previous assessments are completed
      const previousAssessments = assessments.filter(a => a.order < targetAssessment.order);
      
      for (const prevAssessment of previousAssessments) {
        if (!this.isAssessmentCompleted(userEmail, prevAssessment.assessment_id)) {
          
          return false;
        }
      }

      
      return true;
    } catch (error) {
      console.error('Error checking assessment unlock status:', error);
      return false;
    }
  }

  // Get the next available (unlocked) assessment for a user
  static async getNextUnlockedAssessment(userEmail: string): Promise<Assessment | null> {
    try {
      const assessments = await this.getAssessments();
      
      // Find the first assessment that is not completed
      for (const assessment of assessments) {
        if (!this.isAssessmentCompleted(userEmail, assessment.assessment_id)) {
          // Check if it's unlocked
          const isUnlocked = await this.isAssessmentUnlocked(userEmail, assessment.assessment_id);
          if (isUnlocked) {
            
            return assessment;
          } else {
            
            return null; // If next incomplete assessment is locked, no unlocked assessments available
          }
        }
      }

      
      return null;
    } catch (error) {
      console.error('Error getting next unlocked assessment:', error);
      return null;
    }
  }

  // Get next assessment based on order
  static async getNextAssessment(currentAssessmentId: string): Promise<Assessment | null> {
    try {
      const assessments = await this.getAssessments();
      
      // Find current assessment
      const currentAssessment = assessments.find(a => a.assessment_id === currentAssessmentId);
      if (!currentAssessment) {
        
        return null;
      }
      
      // Find next assessment by order
      const nextAssessment = assessments.find(a => a.order > currentAssessment.order);
      
      if (nextAssessment) {
        
        return nextAssessment;
      } else {
        
        return null;
      }
    } catch (error) {
      console.error('Error getting next assessment:', error);
      return null;
    }
  }
}
 