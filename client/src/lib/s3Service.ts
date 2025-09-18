const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const API_ADMIN_URL = import.meta.env.VITE_API_ADMIN_URL || 'https://tqqg7hko9g.execute-api.us-west-2.amazonaws.com/api';

// Import authenticated services
import { AuthenticatedApiService, AuthenticatedAdminApiService } from './authenticatedApiService';

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
  words?: string[]; // For TripleStep assessments - words associated with this topic
}

export interface FetchQuestionsRequest {
  user_email: string;
  assessment_id: string;
  type?: string;
}

export interface PromptPart {
  text: {
    S: string;
  };
}

export interface DynamoPrompt {
  prompt_name?: {
    S: string;
  };
  Meaning?: {
    S: string;
  };
  parts?: {
    L: Array<{
      M: PromptPart;
    }>;
  };
}

export interface FetchQuestionsResponse {
  questions?: Question[];
  content?: DynamoPrompt; // For Games-arena responses
  status?: string;
  message?: string;
  completed_at?: string;
  audio_key?: string;
  prompt?: DynamoPrompt;
  type?: string;
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

// Triple Step specific interfaces
export interface TripleStepContent {
  [topic: string]: string[];
}

// New Triple Step response format
export interface TripleStepNewFormat {
  questions: Array<{
    id: string;
    text: string;
  }>;
  words: string[];
}

export interface FetchTripleStepRequest {
  user_email: string;
  assessment_id: string;
}

export interface FetchTripleStepResponse {
  content?: TripleStepContent;
  questions?: TripleStepNewFormat['questions'];
  words?: TripleStepNewFormat['words'];
  status?: string;
  message?: string;
}

// Admin interfaces for all tests endpoint
export interface AdminTest {
  test_id: string;
  test_name: string;
}

export interface AllTestsResponse {
  status: string;
  total_tests: number;
  tests: AdminTest[];
  timestamp: string;
}

// Assessment progress interfaces
export interface AssessmentProgress {
  assessment_id: string;
  assessment_name: string;
  description: string;
  time_limit: number;
  completed_count: number;
}

export interface AssessmentProgressResponse {
  status: string;
  data: {
    test_id: string;
    assessments: AssessmentProgress[];
    timestamp: string;
  };
}

// Assessment users interfaces
export interface AssessmentUser {
  user_email: string;
  test_id: string;
  completed_at: string | null;
  status: string;
}

export interface AssessmentSummary {
  total_users_assigned: number;
  total_users_completed: number;
  total_users_not_started: number;
}

export interface AssessmentUsersResponse {
  status: string;
  assessment_id: string;
  test_id: string;
  assessment_name: string;
  description: string;
  time_limit: number;
  summary?: AssessmentSummary; // Made optional to handle backward compatibility
  users: AssessmentUser[];
  timestamp: string;
}

// All users interfaces
export interface AllUser {
  user_email: string;
  last_active: string | null;
}

export interface AllUsersResponse {
  status: string;
  total_users: number;
  users: AllUser[];
  timestamp: string;
}

// User Details interfaces
export interface UserAssessment {
  assessment_id: string;
  assessment_name: string;
  completed_at: string;
  image_count: number;
}

export interface UserTest {
  test_id: string;
  status: string;
  started_at: string;
  last_updated: string;
  completed_assessments: UserAssessment[];
  total_assessments_completed: number;
  total_images_uploaded: number;
}

export interface UserDetails {
  status: string;
  user_email: string;
  total_tests: number;
  tests: UserTest[];
}

export class S3Service {
  private static assessmentCache: AssessmentCache | null = null;
  private static completedAssessmentCache: CompletedAssessmentCache = {};
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
  private static readonly COMPLETION_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  static async initiateAssessment(request: InitiateAssessmentRequest): Promise<InitiateAssessmentResponse> {
    try {
      console.log('🔍 S3Service: Initiating assessment with Firebase auth');
      return await AuthenticatedApiService.initiateAssessment(request);
    } catch (error) {
      console.error('Error initiating assessment:', error);
      throw error;
    }
  }

  static async getAudioDownloadUrl(request: AudioDownloadRequest): Promise<AudioDownloadResponse> {
    try {
      console.log('🔍 S3Service: Getting audio download URL with Firebase auth');
      return await AuthenticatedApiService.getAudioDownloadUrl(request);
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
      console.log('🔍 S3Service: Uploading logs with Firebase auth');
      return await AuthenticatedApiService.uploadLogs(request);
    } catch (error) {
      console.error('Error uploading logs:', error);
      throw error;
    }
  }

  static async verifyAudio(request: AudioVerificationRequest): Promise<AudioVerificationResponse> {
    try {
      console.log('🔍 S3Service: Verifying audio with Firebase auth');
      return await AuthenticatedApiService.verifyAudio(request);
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
        console.log('🔍 S3Service: Using cached assessments');
        return this.assessmentCache.data;
      }

      console.log('🔍 S3Service: Fetching assessments with Firebase auth');
      const data: AssessmentsResponse = await AuthenticatedApiService.getAssessments();

      const responseHash = this.hashString(JSON.stringify(data));

      // Check if response has changed compared to cache
      if (this.assessmentCache && this.assessmentCache.hash === responseHash) {
        console.log('🔍 S3Service: Assessments data unchanged, updating timestamp');
        this.assessmentCache.timestamp = now;
        return this.assessmentCache.data;
      }

      // Sort by order
      const sortedAssessments = data.assessments.sort((a, b) => a.order - b.order);

      // Update cache
      this.assessmentCache = {
        data: sortedAssessments,
        timestamp: now,
        hash: responseHash
      };

      console.log('✅ S3Service: Assessments fetched and cached with auth');
      return sortedAssessments;
    } catch (error) {
      console.error('Error fetching assessments:', error);

      // If we have cached data and there's an error, return cached data
      if (this.assessmentCache) {
        console.log('⚠️ S3Service: Using cached assessments due to error');
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



      console.log('🔍 S3Service: Fetching questions with Firebase auth');
      const data: FetchQuestionsResponse = await AuthenticatedApiService.fetchQuestions(request);

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

      // Handle different assessment types based on their response structure
      if (request.type === 'Games-arena') {
        // Games-arena returns prompt data in 'content' field, not 'questions'
        const promptData = data.questions || data.content;
        if (!promptData) {
          throw new Error('No prompt data returned for Games-arena assessment');
        }

        console.log('🎯 Games-arena prompt data received:', promptData);

        // For Games-arena, return the prompt as a single "question" for compatibility
        const dynamoPromptData = promptData as DynamoPrompt; // Cast to DynamoPrompt for Games-arena
        const promptQuestion: Question = {
          question_id: `games-arena-${request.assessment_id}`,
          question_text: dynamoPromptData.prompt_name?.S || 'Games Arena Assessment',
          order: 1,
          type: 'Games-arena'
        };
        return [promptQuestion];
      } else if (request.type === 'Triple-Step') {
        // Handle TripleStep specifically - use the new function
        return await this.fetchTripleStepQuestions({
          user_email: request.user_email,
          assessment_id: request.assessment_id
        });
      } else if (request.type === 'Conductor') {
        // Handle Conductor assessments - convert topics to questions format
        const content = (data as any).content;
        if (!content || !content.topics || !Array.isArray(content.topics) || content.topics.length === 0) {
          throw new Error(`No topics returned for Conductor assessment type`);
        }

        // Store the raw config data in localStorage for ConductorAssessment component to use
        localStorage.setItem(`conductor-config-${request.assessment_id}`, JSON.stringify(content));
        console.log('💾 Stored Conductor config data in localStorage');

        // Convert topics array to questions format
        const conductorQuestions = content.topics.map((topic: string, index: number) => ({
          question_id: `conductor-${request.assessment_id}-${index + 1}`,
          question_text: topic,
          order: index + 1,
          type: 'Conductor'
        }));

        console.log('✅ Converted Conductor topics to questions:', conductorQuestions.length, 'questions');
        return conductorQuestions;
      } else {
        // Handle all other assessment types (QA, etc.) - they return questions array
        if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
          throw new Error(`No questions returned for ${request.type || 'unknown'} assessment type`);
        }

        // Sort by order
        const sortedQuestions = data.questions.sort((a, b) => a.order - b.order);

        return sortedQuestions;
      }
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

    // Trigger a custom event to notify other parts of the app
    this.notifyAssessmentCompleted(assessmentId, userEmail);
  }

  // Utility method to notify when an assessment is completed
  static notifyAssessmentCompleted(assessmentId: string, userEmail: string): void {
    const assessmentCompletedEvent = new CustomEvent('assessmentCompleted', {
      detail: {
        assessmentId: assessmentId,
        userEmail: userEmail
      }
    });
    window.dispatchEvent(assessmentCompletedEvent);
    console.log(`📢 Assessment completion event dispatched for ${assessmentId}`);
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

  // Get the next available (unlocked) assessment for a user within a specific test
  static async getNextUnlockedAssessmentInTest(userEmail: string, testId: string): Promise<Assessment | null> {
    try {
      // Fetch test-specific assessments with authentication
      console.log('🔍 S3Service: Fetching test assessments with Firebase auth for test:', testId);
      const data = await AuthenticatedApiService.getTestAssessments(testId);
      const testAssessments = data.assessments || [];

      // Sort by order to ensure we check in the correct sequence
      testAssessments.sort((a: any, b: any) => a.order - b.order);

      // Find the first assessment in this test that is not completed
      for (const testAssessment of testAssessments) {
        if (!this.isAssessmentCompleted(userEmail, testAssessment.assessment_id)) {
          // Convert to Assessment format
          const assessment: Assessment = {
            assessment_id: testAssessment.assessment_id,
            assessment_name: testAssessment.assessment_name,
            description: testAssessment.description,
            type: testAssessment.type,
            order: testAssessment.order,
          };

          // For test-specific assessments, use custom unlock logic
          const isUnlocked = this.isTestAssessmentUnlocked(userEmail, testAssessment, testAssessments);
          if (isUnlocked) {
            console.log(`✅ Next unlocked assessment in test ${testId}:`, assessment.assessment_name);
            return assessment;
          } else {
            console.log(`🔒 Next assessment in test ${testId} is locked:`, assessment.assessment_name);
            return null; // If next incomplete assessment is locked, no unlocked assessments available
          }
        }
      }

      console.log(`✅ All assessments completed in test ${testId}`);
      return null;
    } catch (error) {
      console.error('Error getting next unlocked assessment in test:', error);
      return null;
    }
  }

  // Custom unlock logic for test-based assessments
  private static isTestAssessmentUnlocked(userEmail: string, targetAssessment: any, allTestAssessments: any[]): boolean {
    // Find the minimum order (first assessment)
    const minOrder = Math.min(...allTestAssessments.map((a: any) => a.order));

    // First assessment is always unlocked
    if (targetAssessment.order === minOrder) {
      return true;
    }

    // Check if all previous assessments (lower order) are completed
    const previousAssessments = allTestAssessments.filter((a: any) => a.order < targetAssessment.order);

    for (const prevAssessment of previousAssessments) {
      const isCompleted = this.isAssessmentCompleted(userEmail, prevAssessment.assessment_id);
      if (!isCompleted) {
        return false;
      }
    }

    return true;
  }

  // DEPRECATED: Legacy method - use getNextUnlockedAssessmentInTest instead
  static async getNextUnlockedAssessment(userEmail: string): Promise<Assessment | null> {
    console.warn('⚠️ getNextUnlockedAssessment is deprecated - use getNextUnlockedAssessmentInTest instead');
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

  // Admin method to fetch all tests
  static async getAllTests(): Promise<AdminTest[]> {
    try {
      console.log('🔍 S3Service: Fetching all tests for admin with Firebase auth');
      return await AuthenticatedAdminApiService.getAllTests();
    } catch (error) {
      console.error('Error fetching all tests:', error);
      throw error;
    }
  }

  // Admin method to fetch assessment progress for a specific test
  static async getAssessmentProgress(testId: string): Promise<AssessmentProgress[]> {
    try {
      console.log('🔍 S3Service: Fetching assessment progress for test with Firebase auth:', testId);
      return await AuthenticatedAdminApiService.getAssessmentProgress(testId);
    } catch (error) {
      console.error('Error fetching assessment progress:', error);
      throw error;
    }
  }

  // Admin method to fetch users who completed a specific assessment
  static async getAssessmentUsers(assessmentId: string): Promise<AssessmentUsersResponse> {
    try {
      console.log('🔍 S3Service: Fetching users for assessment with Firebase auth:', assessmentId);
      return await AuthenticatedAdminApiService.getAssessmentUsers(assessmentId);
    } catch (error) {
      console.error('Error fetching assessment users:', error);
      throw error;
    }
  }

  // Admin method to fetch all users
  static async getAllUsers(): Promise<AllUser[]> {
    try {
      console.log('🔍 S3Service: Fetching all users for admin with Firebase auth');
      return await AuthenticatedAdminApiService.getAllUsers();
    } catch (error) {
      console.error('Error fetching all users:', error);
      throw error;
    }
  }

  // Get user details by email
  static async getUserDetails(userEmail: string): Promise<UserDetails> {
    try {
      console.log('🔍 S3Service: Fetching user details with Firebase auth for:', userEmail);
      return await AuthenticatedAdminApiService.getUserDetails(userEmail);
    } catch (error) {
      console.error('Error fetching user details:', error);
      throw error;
    }
  }

  // Fetch Triple Step questions in standard format
  static async fetchTripleStepQuestions(request: FetchTripleStepRequest): Promise<Question[]> {
    try {
      console.log('[S3Service] Fetching Triple Step questions for:', request);

      // For TripleStep, we need to request the full content and convert to question format
      const tripleStepRequest = {
        ...request,
        type: 'triple-step', // This tells the backend to return full JSON content
        fetch_full_content: true // Additional flag to ensure we get all content
      };

        console.log('🔍 S3Service: Fetching Triple Step questions with Firebase auth');
        const data = await AuthenticatedApiService.fetchQuestions(tripleStepRequest);
        console.log('Raw data received from backend:', data);
        console.log('Data structure analysis:', {
          hasContent: !!data.content,
          contentType: typeof data.content,
          isContentArray: Array.isArray(data.content),
          contentKeys: data.content ? Object.keys(data.content) : [],
          hasContentQuestions: !!(data.content && data.content.questions),
          hasContentWords: !!(data.content && data.content.words),
          directQuestions: !!data.questions,
          directWords: !!data.words
        });

      if (data.status === 'completed') {
        throw new Error(`ASSESSMENT_COMPLETED:${JSON.stringify(data)}`);
      }

      // Handle both old format (content) and new format (questions + words)
      let questions: Question[];
      
      if (data.content && data.content.questions && Array.isArray(data.content.questions) && data.content.words && Array.isArray(data.content.words)) {
        // New format - nested in content: {questions: [...], words: [...]}
        const newFormat = data.content as TripleStepNewFormat;
        console.log('Using new TripleStep format (nested content with questions + words arrays)');
        
        if (newFormat.questions.length === 0) {
          throw new Error('No questions found in new TripleStep format');
        }
        
        if (newFormat.words.length === 0) {
          throw new Error('No words found in new TripleStep format');
        }

        // Get the number of questions from the backend assessment data
        let questionsToSelect = newFormat.questions.length; // Default to all questions
        
        // Try to get the question count from the backend (from test-available endpoint)
        try {
          const selectedTestId = localStorage.getItem('selectedTestId');
          if (selectedTestId) {
            const { AuthenticatedApiService } = await import('@/lib/authenticatedApiService');
            const testData = await AuthenticatedApiService.getTestAssessments(selectedTestId);
            const assessmentInTest = testData.assessments?.find((a: any) => a.assessment_id === request.assessment_id);
            if (assessmentInTest && assessmentInTest.no_of_ques) {
              questionsToSelect = Math.floor(assessmentInTest.no_of_ques);
              console.log(`📊 Using no_of_ques from backend: ${questionsToSelect} questions`);
            }
          }
        } catch (error) {
          console.warn('Could not fetch backend question count, using all questions:', error);
        }

        // Shuffle and select the specified number of questions
        const shuffledQuestions = [...newFormat.questions].sort(() => Math.random() - 0.5);
        const selectedQuestions = shuffledQuestions.slice(0, Math.min(questionsToSelect, newFormat.questions.length));

        // Convert to standard Question format
        questions = selectedQuestions.map((q, index) => ({
          question_id: q.id || `q${index + 1}`,
          question_text: q.text,
          order: index + 1,
          type: 'triple-step',
          // For new format, each question gets random words from the shared word pool
          words: [...newFormat.words].sort(() => Math.random() - 0.5) // Shuffle words for randomness
        }));
        
        console.log(`Loaded ${selectedQuestions.length} questions (from ${newFormat.questions.length} available) and ${newFormat.words.length} words from new TripleStep format`);
        
      } else if (data.content && typeof data.content === 'object' && !Array.isArray(data.content)) {
        // Old format - content is topic-word mapping object
        const content: TripleStepContent = data.content;
        console.log('Using old TripleStep format (topic-word mapping)');
        
        const topics = Object.keys(content);
        if (topics.length === 0) {
          throw new Error('No topics found in TripleStep content');
        }

        // Select only 3 random topics from the available topics
        const shuffledTopics = [...topics].sort(() => Math.random() - 0.5);
        const selectedTopics = shuffledTopics.slice(0, Math.min(3, topics.length));

        // Convert to standard Question format (only 3 questions)
        questions = selectedTopics.map((topic, index) => ({
          question_id: `q${index + 1}`,
          question_text: topic,
          order: index + 1,
          type: 'triple-step',
          words: content[topic] || []
        }));
        
        console.log('Loaded', topics.length, 'topics from old TripleStep format');
        
      } else {
        throw new Error('Invalid TripleStep response format - expected either content (old) or questions+words (new)');
      }

      console.log('[S3Service] Triple Step questions converted successfully:', {
        questionsGenerated: questions.length,
        totalWords: questions.reduce((sum, q) => sum + (q.words?.length || 0), 0),
        format: (data.content && data.content.questions) ? 'new (questions + words arrays)' : 'old (topic-word mapping)',
        sampleQuestions: questions.slice(0, 3).map(q => ({
          id: q.question_id,
          text: q.question_text,
          wordsCount: q.words?.length || 0
        }))
      });

      return questions;
    } catch (error) {
      console.error('Error fetching Triple Step questions:', error);
      throw error;
    }
  }
}
