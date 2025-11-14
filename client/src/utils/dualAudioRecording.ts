// Dual audio recording system for user and AI voices
export class DualAudioRecorder {
  private userMediaRecorder: MediaRecorder | null = null;
  private aiMediaRecorder: MediaRecorder | null = null;
  private userRecordedChunks: Blob[] = [];
  private aiRecordedChunks: Blob[] = [];
  private isRecording: boolean = false;
  private userStream: MediaStream | null = null;
  private aiAudioContext: AudioContext | null = null;
  private aiDestination: MediaStreamAudioDestinationNode | null = null;
  private aiGainNode: GainNode | null = null;
  private aiSampleRate: number = 24000; // Gemini uses 24kHz
  
  // High-quality PCM16 capture for AI audio with timestamps
  private aiPCMChunks: Array<{data: ArrayBuffer, timestamp: number}> = [];
  private userPCMChunks: Array<{data: ArrayBuffer, timestamp: number}> = [];
  private recordingStartTime: number = 0;
  
  // Mixed recording for conversation flow
  private mixedMediaRecorder: MediaRecorder | null = null;
  private mixedRecordedChunks: Blob[] = [];
  private mixerNode: GainNode | null = null;
  private userGainNode: GainNode | null = null;
  
  // Improved AI audio streaming
  private aiSourceNodes: AudioBufferSourceNode[] = [];
  private nextSourceStartTime: number = 0;

  constructor() {}

  async startDualRecording(userStream: MediaStream, audioContext: AudioContext): Promise<void> {
    try {
      console.log('🎙️ Starting dual audio recording...');
      
      if (!window.MediaRecorder) {
        throw new Error('MediaRecorder API is not supported in this browser');
      }

      this.userStream = userStream;
      this.aiAudioContext = audioContext;
      this.recordingStartTime = Date.now();
      this.nextSourceStartTime = audioContext.currentTime;

      // Create stereo mixer for real-time conversation recording
      this.mixerNode = audioContext.createGain();
      this.mixerNode.gain.value = 1.0;
      
      // Create separate gain nodes for user and AI
      this.userGainNode = audioContext.createGain();
      this.userGainNode.gain.value = 0.9; // Higher user volume for clarity
      
      this.aiGainNode = audioContext.createGain();
      this.aiGainNode.gain.value = 0.85; // Higher AI volume to prevent buffering artifacts
      
      // Create stereo merger for mixed output
      const stereoMerger = audioContext.createChannelMerger(2);
      
      // Connect user audio to left channel
      const userSource = audioContext.createMediaStreamSource(userStream);
      userSource.connect(this.userGainNode);
      this.userGainNode.connect(stereoMerger, 0, 0); // Left channel
      
      // AI audio will connect to right channel when available
      this.aiGainNode.connect(stereoMerger, 0, 1); // Right channel
      
      // Create destination for mixed recording
      this.aiDestination = audioContext.createMediaStreamDestination();
      stereoMerger.connect(this.aiDestination);
      
      const aiStream = this.aiDestination.stream;

      console.log('👤 User stream details:', {
        active: userStream.active,
        tracks: userStream.getTracks().length
      });

      console.log('🤖 AI stream details:', {
        active: aiStream.active,
        tracks: aiStream.getTracks().length,
        hasGainNode: !!this.aiGainNode
      });

      // Set up user audio recording directly from source stream
      const userMimeType = this.getSupportedMimeType();
      this.userMediaRecorder = new MediaRecorder(userStream, {
        mimeType: userMimeType,
        audioBitsPerSecond: 128000
      });

      console.log('👤 User MediaRecorder created with MIME type:', userMimeType);

      // Set up AI audio recording (for separate track)
      const aiMimeType = this.getSupportedMimeType();
      this.aiMediaRecorder = new MediaRecorder(aiStream, {
        mimeType: aiMimeType,
      });

      console.log('🤖 AI MediaRecorder created with MIME type:', aiMimeType);

      // Set up mixed conversation recording (real-time stereo)
      const mixedMimeType = this.getSupportedMimeType();
      this.mixedMediaRecorder = new MediaRecorder(this.aiDestination.stream, {
        mimeType: mixedMimeType,
        audioBitsPerSecond: 192000 // Higher bitrate for better quality
      });

      console.log('🎵 Mixed conversation MediaRecorder created with MIME type:', mixedMimeType);

      // Reset chunks
      this.userRecordedChunks = [];
      this.aiRecordedChunks = [];

      // Set up event handlers for user recording
      this.userMediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.isRecording) {
          this.userRecordedChunks.push(event.data);
        } else if (event.data.size > 0 && !this.isRecording) {
          console.log('🚫 Ignoring user chunk after recording stopped:', event.data.size, 'bytes');
        }
      };

      this.userMediaRecorder.onstop = () => {
        console.log('👤 User recording stopped. Total chunks:', this.userRecordedChunks.length);
      };

      this.userMediaRecorder.onerror = (event) => {
        console.error('👤 User MediaRecorder error:', event);
      };

      // Set up event handlers for AI recording
      this.aiMediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.isRecording) {
          this.aiRecordedChunks.push(event.data);
        } else if (event.data.size > 0 && !this.isRecording) {
          console.log('🚫 Ignoring AI chunk after recording stopped:', event.data.size, 'bytes');
        }
      };

      this.aiMediaRecorder.onstop = () => {
        console.log('🤖 AI recording stopped. Total chunks:', this.aiRecordedChunks.length);
      };

      this.aiMediaRecorder.onerror = (event) => {
        console.error('🤖 AI MediaRecorder error:', event);
      };

      // Set up event handlers for mixed conversation recording
      this.mixedRecordedChunks = [];
      this.mixedMediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.isRecording) {
          this.mixedRecordedChunks.push(event.data);
        } else if (event.data.size > 0 && !this.isRecording) {
          console.log('🚫 Ignoring mixed chunk after recording stopped:', event.data.size, 'bytes');
        }
      };

      this.mixedMediaRecorder.onstop = () => {
        console.log('🎵 Mixed conversation recording stopped. Total chunks:', this.mixedRecordedChunks.length);
      };

      this.mixedMediaRecorder.onerror = (event) => {
        console.error('🎵 Mixed conversation MediaRecorder error:', event);
      };

      // Start all three recordings with synchronized timing
      const timeslice = 100; // 100ms chunks for smoother mixed audio
      this.userMediaRecorder.start(timeslice);
      this.aiMediaRecorder.start(timeslice);
      this.mixedMediaRecorder.start(timeslice);
      this.isRecording = true;

      console.log('🎙️ Dual recording started successfully');
    } catch (error) {
      console.error('🚨 Error starting dual recording:', error);
      throw error;
    }
  }

  connectAIAudio(aiSource: AudioBufferSourceNode): void {
    if (this.aiGainNode && aiSource) {
      try {
        aiSource.connect(this.aiGainNode);
        console.log('🔗 AI audio source connected to recorder');
      } catch (error) {
        console.error('🚨 Error connecting AI audio:', error);
      }
    }
  }

  // Capture high-quality user PCM16 data from AudioWorklet
  captureUserPCM16(arrayBuffer: ArrayBuffer): void {
    if (this.isRecording) {
      const timestamp = Date.now() - this.recordingStartTime;
      this.userPCMChunks.push({
        data: arrayBuffer.slice(0),
        timestamp: timestamp
      });
    } else {
      console.log('🚫 Ignoring user PCM16 data after recording stopped:', arrayBuffer.byteLength, 'bytes');
    }
  }

  connectAIAudioFromArrayBuffer(audioData: ArrayBuffer): void {
    if (!this.aiAudioContext || !this.aiGainNode || !this.isRecording) {
      console.warn('🚨 AI audio context not available or not recording');
      return;
    }

    try {
      // DUAL APPROACH: Store high-quality PCM16 + stream for timing
      
      // 1. Capture high-quality PCM16 data directly with timestamp
      const timestamp = Date.now() - this.recordingStartTime;
      this.aiPCMChunks.push({
        data: audioData.slice(0),
        timestamp: timestamp
      });
      
      // 2. Convert PCM16 data to Float32 for real-time streaming (for timing)
      const pcm16Array = new Int16Array(audioData);
      
      if (pcm16Array.length === 0) {
        console.warn('🚨 Empty PCM16 array received');
        return;
      }

      // Create audio buffer from PCM16 data for timing preservation
      const audioBuffer = this.aiAudioContext.createBuffer(1, pcm16Array.length, this.aiSampleRate);
      const channelData = audioBuffer.getChannelData(0);
      
      // Convert PCM16 to Float32 (-1 to 1 range)
      for (let i = 0; i < pcm16Array.length; i++) {
        channelData[i] = pcm16Array[i] / 32768;
      }
      
      // Create source node and connect to AI recording stream
      const source = this.aiAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.aiGainNode);
      
      // Schedule audio to play at precise time to prevent gaps/overlaps
      const currentTime = this.aiAudioContext.currentTime;
      const startTime = Math.max(currentTime, this.nextSourceStartTime);
      
      source.start(startTime);
      
      // Update next start time to prevent overlaps
      this.nextSourceStartTime = startTime + audioBuffer.duration;
      
      // Store reference for cleanup
      this.aiSourceNodes.push(source);
      
      // Clean up finished sources
      source.onended = () => {
        const index = this.aiSourceNodes.indexOf(source);
        if (index > -1) {
          this.aiSourceNodes.splice(index, 1);
        }
      };
    } catch (error) {
      console.error('🚨 Error connecting AI audio from ArrayBuffer:', error);
    }
  }

  async stopDualRecording(): Promise<{ userBlob: Blob; aiBlob: Blob; mixedBlob: Blob }> {
    return new Promise((resolve, reject) => {
      if (!this.isRecording || !this.userMediaRecorder || !this.aiMediaRecorder || !this.mixedMediaRecorder) {
        reject(new Error('Recording not in progress'));
        return;
      }

      console.log('🛑 Stopping dual recording...');

      let userStopped = false;
      let aiStopped = false;
      let mixedStopped = false;

      const checkCompletion = () => {
        if (userStopped && aiStopped && mixedStopped) {
          // Create high-quality WAV files from captured PCM16 data
          const userBlob = this.createUserWAVBlob();
          const aiBlob = this.createAIWAVBlob();
          
          // Create mixed conversation blob (real-time stereo)
          const mixedBlob = new Blob(this.mixedRecordedChunks, { type: 'audio/webm' });

          console.log('✅ Dual recording completed with conversation flow:', {
            userSize: userBlob.size,
            aiSize: aiBlob.size,
            mixedSize: mixedBlob.size,
            userPCMChunks: this.userPCMChunks.length,
            aiPCMChunks: this.aiPCMChunks.length,
            mixedMediaChunks: this.mixedRecordedChunks.length,
            totalDuration: `${((Date.now() - this.recordingStartTime) / 1000).toFixed(1)}s`
          });

          this.isRecording = false;
          resolve({ userBlob, aiBlob, mixedBlob });
        }
      };

      // Set up completion handlers
      this.userMediaRecorder.onstop = () => {
        userStopped = true;
        checkCompletion();
      };

      this.aiMediaRecorder.onstop = () => {
        aiStopped = true;
        checkCompletion();
      };

      this.mixedMediaRecorder.onstop = () => {
        mixedStopped = true;
        checkCompletion();
      };

      // Stop recording immediately to prevent more events
      this.isRecording = false;
      console.log('🛑 Recording flag set to false - no more chunks should be captured');

      // Stop all three recordings
      try {
        if (this.userMediaRecorder.state === 'recording') {
          this.userMediaRecorder.stop();
        } else {
          userStopped = true;
        }

        if (this.aiMediaRecorder.state === 'recording') {
          this.aiMediaRecorder.stop();
        } else {
          aiStopped = true;
        }

        if (this.mixedMediaRecorder.state === 'recording') {
          this.mixedMediaRecorder.stop();
        } else {
          mixedStopped = true;
        }

        checkCompletion();
      } catch (error) {
        console.error('🚨 Error stopping recordings:', error);
        reject(error);
      }

      // Fallback timeout
      setTimeout(() => {
        if (!userStopped || !aiStopped || !mixedStopped) {
          console.warn('⚠️ Recording stop timeout, forcing completion');
          const userBlob = this.createUserWAVBlob();
          const aiBlob = this.createAIWAVBlob();
          const mixedBlob = new Blob(this.mixedRecordedChunks, { type: 'audio/webm' });
          this.isRecording = false;
          resolve({ userBlob, aiBlob, mixedBlob });
        }
      }, 5000);
    });
  }

  private createUserWAVBlob(): Blob {
    try {
      if (this.userPCMChunks.length === 0) {
        console.warn('⚠️ No user PCM data to convert');
        return new Blob([], { type: 'audio/wav' });
      }

      // Calculate total byte length from timestamped chunks
      const totalBytes = this.userPCMChunks.reduce((sum, chunk) => sum + chunk.data.byteLength, 0);
      console.log('📊 User PCM data info:', {
        chunks: this.userPCMChunks.length,
        totalBytes: totalBytes,
        totalSamples: totalBytes / 2,
        duration: `${(totalBytes / 2 / 16000).toFixed(2)}s`, // 16kHz user audio
        timeSpan: this.userPCMChunks.length > 0 ? 
          `${this.userPCMChunks[0].timestamp}ms - ${this.userPCMChunks[this.userPCMChunks.length - 1].timestamp}ms` : '0ms'
      });

      // Sort chunks by timestamp to ensure proper order
      this.userPCMChunks.sort((a, b) => a.timestamp - b.timestamp);

      // Combine all user PCM chunks
      const combinedPCM = new ArrayBuffer(totalBytes);
      const combinedView = new Uint8Array(combinedPCM);
      let offset = 0;
      
      for (const chunk of this.userPCMChunks) {
        const chunkView = new Uint8Array(chunk.data);
        combinedView.set(chunkView, offset);
        offset += chunk.data.byteLength;
      }

      // Convert to high-quality WAV (16kHz)
      const wavBlob = this.createWAVFromPCM16(combinedPCM, 16000);
      console.log('✅ User PCM16 converted to WAV:', wavBlob.size, 'bytes');
      
      return wavBlob;
    } catch (error) {
      console.error('🚨 Error creating user WAV blob:', error);
      return new Blob([], { type: 'audio/wav' });
    }
  }

  private createAIWAVBlob(): Blob {
    try {
      if (this.aiPCMChunks.length === 0) {
        console.warn('⚠️ No AI PCM data to convert');
        return new Blob([], { type: 'audio/wav' });
      }

      // Calculate total byte length from timestamped chunks
      const totalBytes = this.aiPCMChunks.reduce((sum, chunk) => sum + chunk.data.byteLength, 0);
      console.log('📊 AI PCM data info:', {
        chunks: this.aiPCMChunks.length,
        totalBytes: totalBytes,
        totalSamples: totalBytes / 2,
        duration: `${(totalBytes / 2 / this.aiSampleRate).toFixed(2)}s`, // 24kHz AI audio
        timeSpan: this.aiPCMChunks.length > 0 ? 
          `${this.aiPCMChunks[0].timestamp}ms - ${this.aiPCMChunks[this.aiPCMChunks.length - 1].timestamp}ms` : '0ms'
      });

      // Sort chunks by timestamp to ensure proper order
      this.aiPCMChunks.sort((a, b) => a.timestamp - b.timestamp);

      // Combine all AI PCM chunks
      const combinedPCM = new ArrayBuffer(totalBytes);
      const combinedView = new Uint8Array(combinedPCM);
      let offset = 0;
      
      for (const chunk of this.aiPCMChunks) {
        const chunkView = new Uint8Array(chunk.data);
        combinedView.set(chunkView, offset);
        offset += chunk.data.byteLength;
      }

      // Convert to high-quality WAV (24kHz)
      const wavBlob = this.createWAVFromPCM16(combinedPCM, this.aiSampleRate);
      console.log('✅ AI PCM16 converted to WAV:', wavBlob.size, 'bytes');
      
      return wavBlob;
    } catch (error) {
      console.error('🚨 Error creating AI WAV blob:', error);
      return new Blob([], { type: 'audio/wav' });
    }
  }

  private createWAVFromPCM16(pcmData: ArrayBuffer, sampleRate: number): Blob {
    try {
      if (!pcmData || pcmData.byteLength === 0) {
        console.warn('No PCM data provided for WAV creation');
        return new Blob([], { type: 'audio/wav' });
      }

      const numChannels = 1; // Mono
      const bitsPerSample = 16;
      const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
      const blockAlign = numChannels * (bitsPerSample / 8);
      
      // Create WAV header (44 bytes)
      const buffer = new ArrayBuffer(44 + pcmData.byteLength);
      const view = new DataView(buffer);
      
      // WAV header
      const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };
      
      // RIFF chunk descriptor
      writeString(0, 'RIFF');
      view.setUint32(4, 36 + pcmData.byteLength, true); // File size - 8
      writeString(8, 'WAVE');
      
      // fmt sub-chunk
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true); // Sub-chunk 1 size (16 for PCM)
      view.setUint16(20, 1, true); // Audio format (1 = PCM)
      view.setUint16(22, numChannels, true); // Number of channels
      view.setUint32(24, sampleRate, true); // Sample rate
      view.setUint32(28, byteRate, true); // Byte rate
      view.setUint16(32, blockAlign, true); // Block align
      view.setUint16(34, bitsPerSample, true); // Bits per sample
      
      // data sub-chunk
      writeString(36, 'data');
      view.setUint32(40, pcmData.byteLength, true); // Sub-chunk 2 size
      
      // Copy PCM data directly (preserves original quality)
      const pcmView = new Uint8Array(pcmData);
      const wavView = new Uint8Array(buffer, 44);
      wavView.set(pcmView);
      
      return new Blob([buffer], { type: 'audio/wav' });
    } catch (error) {
      console.error('Error creating WAV blob from PCM16:', error);
      return new Blob([], { type: 'audio/wav' });
    }
  }

  async mergeToStereo(userBlob: Blob, aiBlob: Blob): Promise<Blob> {
    try {
      console.log('🔄 Merging audio to stereo...');
      
      const audioContext = new AudioContext();
      
      // Decode both audio blobs
      const [userBuffer, aiBuffer] = await Promise.all([
        this.decodeAudioBlob(userBlob, audioContext),
        this.decodeAudioBlob(aiBlob, audioContext)
      ]);

      if (!userBuffer && !aiBuffer) {
        console.warn('⚠️ No valid audio data to merge');
        return new Blob([], { type: 'audio/wav' });
      }

      // Determine the length of the merged audio
      const maxLength = Math.max(
        userBuffer?.length || 0,
        aiBuffer?.length || 0
      );

      if (maxLength === 0) {
        console.warn('⚠️ All audio buffers are empty');
        return new Blob([], { type: 'audio/wav' });
      }

      // Create stereo buffer (user=left, AI=right)
      const sampleRate = userBuffer?.sampleRate || aiBuffer?.sampleRate || 48000;
      const stereoBuffer = audioContext.createBuffer(2, maxLength, sampleRate);

      // Fill left channel with user audio
      if (userBuffer) {
        const leftChannel = stereoBuffer.getChannelData(0);
        const userData = userBuffer.getChannelData(0);
        leftChannel.set(userData);
      }

      // Fill right channel with AI audio
      if (aiBuffer) {
        const rightChannel = stereoBuffer.getChannelData(1);
        const aiData = aiBuffer.getChannelData(0);
        rightChannel.set(aiData);
      }

      // Convert to WAV blob
      const wavBlob = this.audioBufferToWav(stereoBuffer);
      console.log('✅ Stereo merge completed:', wavBlob.size, 'bytes');
      
      return wavBlob;
    } catch (error) {
      console.error('🚨 Error merging to stereo:', error);
      return new Blob([], { type: 'audio/wav' });
    }
  }

  private async decodeAudioBlob(blob: Blob, audioContext: AudioContext): Promise<AudioBuffer | null> {
    try {
      if (blob.size === 0) {
        console.warn('⚠️ Empty audio blob provided for decoding');
        return null;
      }

      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      return audioBuffer;
    } catch (error) {
      console.error('🚨 Error decoding audio blob:', error);
      return null;
    }
  }



  private audioBufferToWav(buffer: AudioBuffer): Blob {
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length;
    
    // Create WAV header
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);
    
    // Convert audio data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm'; // Fallback
  }

  getRecordingState(): {
    isRecording: boolean;
    userChunks: number;
    aiChunks: number;
  } {
    return {
      isRecording: this.isRecording,
      userChunks: this.userRecordedChunks.length,
      aiChunks: this.aiRecordedChunks.length
    };
  }

  cleanup(): void {
    if (this.userStream) {
      this.userStream.getTracks().forEach(track => track.stop());
      this.userStream = null;
    }

    if (this.aiAudioContext) {
      this.aiAudioContext.close();
      this.aiAudioContext = null;
    }

    this.userMediaRecorder = null;
    this.aiMediaRecorder = null;
    this.mixedMediaRecorder = null;
    this.aiDestination = null;
    this.aiGainNode = null;
    this.userGainNode = null;
    this.mixerNode = null;
    this.userRecordedChunks = [];
    this.aiRecordedChunks = [];
    this.mixedRecordedChunks = [];
    this.userPCMChunks = [];
    this.aiPCMChunks = [];
    this.recordingStartTime = 0;
    this.nextSourceStartTime = 0;
    
    // Clean up any remaining AI source nodes
    this.aiSourceNodes.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Source may already be stopped
      }
    });
    this.aiSourceNodes = [];
    
    this.isRecording = false;

    console.log('🧹 DualAudioRecorder cleaned up');
  }
}
