// Audio recording utilities for Sales AI Assessment
export interface Recording {
  id: string;
  sessionId: string;
  timestamp: Date;
  userAudio?: Blob;
  aiAudio?: Blob;
  duration: number;
  scenario: string;
  industry?: string;
  persona?: string;
  aiRole?: string;
}

export interface RecordingSession {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  scenario: string;
  industry?: string;
  persona?: string;
  aiRole?: string;
  recordings: Recording[];
}

export interface RecordingStorage {
  saveRecording: (recording: Recording) => Promise<void>;
  getRecording: (id: string) => Promise<Recording | null>;
  getAllRecordings: () => Promise<Recording[]>;
  deleteRecording: (id: string) => Promise<void>;
  saveSession: (session: RecordingSession) => Promise<void>;
  getSession: (sessionId: string) => Promise<RecordingSession | null>;
  getAllSessions: () => Promise<RecordingSession[]>;
  deleteSession: (sessionId: string) => Promise<void>;
}

// Convert base64 audio data to WAV blob
export function base64ToWavBlob(base64Data: string, sampleRate: number = 16000): Blob {
  try {
    if (!base64Data || typeof base64Data !== 'string') {
      console.warn('Invalid base64 data provided');
      return new Blob([], { type: 'audio/wav' });
    }

    const cleanedData = base64Data.replace(/\s/g, '');
    
    if (cleanedData.length === 0) {
      console.warn('Empty base64 data');
      return new Blob([], { type: 'audio/wav' });
    }
    
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleanedData)) {
      console.warn('Invalid base64 format detected');
      return new Blob([], { type: 'audio/wav' });
    }

    let paddedData = cleanedData;
    while (paddedData.length % 4 !== 0) {
      paddedData += '=';
    }
    
    if (paddedData.length > 10000000) {
      console.warn('Base64 data too large, truncating');
      paddedData = paddedData.substring(0, 10000000);
    }
    
    const binaryString = atob(paddedData);
    
    if (binaryString.length === 0) {
      console.warn('Decoded base64 resulted in empty data');
      return new Blob([], { type: 'audio/wav' });
    }
    
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const wavBlob = createWavBlob(bytes, sampleRate);
    return wavBlob;
  } catch (error) {
    console.error('Error converting base64 to WAV:', error, 'Data length:', base64Data?.length || 0);
    return new Blob([], { type: 'audio/wav' });
  }
}

// Convert PCM16 ArrayBuffer to WAV blob
export function pcm16ToWavBlob(pcm16Data: ArrayBuffer, sampleRate: number = 24000): Blob {
  try {
    if (!pcm16Data || pcm16Data.byteLength === 0) {
      console.warn('Invalid PCM16 data provided');
      return new Blob([], { type: 'audio/wav' });
    }

    const pcm16Array = new Int16Array(pcm16Data);
    const wavBlob = createWavBlobFromPCM16(pcm16Array, sampleRate);
    return wavBlob;
  } catch (error) {
    console.error('Error converting PCM16 to WAV:', error);
    return new Blob([], { type: 'audio/wav' });
  }
}

// Create WAV blob from raw audio bytes
function createWavBlob(audioData: Uint8Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + audioData.length);
  const view = new DataView(buffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + audioData.length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM format
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  writeString(36, 'data');
  view.setUint32(40, audioData.length, true);
  
  // Copy audio data
  const uint8Array = new Uint8Array(buffer);
  uint8Array.set(audioData, 44);
  
  return new Blob([uint8Array], { type: 'audio/wav' });
}

// Create WAV blob from PCM16 data
function createWavBlobFromPCM16(pcm16Data: Int16Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + pcm16Data.length * 2);
  const view = new DataView(buffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + pcm16Data.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, pcm16Data.length * 2, true);
  
  // Copy PCM16 data
  const audioDataView = new DataView(buffer, 44);
  for (let i = 0; i < pcm16Data.length; i++) {
    audioDataView.setInt16(i * 2, pcm16Data[i], true);
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
}

// Combine multiple base64 chunks into a single WAV blob
export function combineBase64ChunksToWav(chunks: string[], sampleRate: number = 16000): Blob {
  if (!chunks || chunks.length === 0) {
    return new Blob([], { type: 'audio/wav' });
  }

  try {
    // Decode all chunks
    const allBytes: number[] = [];
    
    for (const chunk of chunks) {
      if (!chunk || !isValidBase64(chunk)) continue;
      
      const cleanedData = chunk.replace(/\s/g, '');
      let paddedData = cleanedData;
      while (paddedData.length % 4 !== 0) {
        paddedData += '=';
      }
      
      const binaryString = atob(paddedData);
      for (let i = 0; i < binaryString.length; i++) {
        allBytes.push(binaryString.charCodeAt(i));
      }
    }
    
    if (allBytes.length === 0) {
      return new Blob([], { type: 'audio/wav' });
    }
    
    const combinedBytes = new Uint8Array(allBytes);
    return createWavBlob(combinedBytes, sampleRate);
  } catch (error) {
    console.error('Error combining base64 chunks:', error);
    return new Blob([], { type: 'audio/wav' });
  }
}

// Utility functions
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2)}`;
}

export function getAudioDuration(audioBlob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(audioBlob);
    
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration || 0);
    };
    
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    
    audio.src = url;
  });
}

export function isValidBase64(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  
  const cleaned = str.replace(/\s/g, '');
  if (cleaned.length === 0) return false;
  
  return /^[A-Za-z0-9+/]*={0,2}$/.test(cleaned);
}

export function hasAudioContent(base64Data: string): boolean {
  if (!isValidBase64(base64Data)) return false;
  
  try {
    const cleaned = base64Data.replace(/\s/g, '');
    return cleaned.length > 0 && atob(cleaned).length > 0;
  } catch {
    return false;
  }
}

export function hasAudioContentPCM16(pcm16Data: ArrayBuffer): boolean {
  return pcm16Data && pcm16Data.byteLength > 0;
}

export function analyzeAudioChunks(chunks: string[]): {
  totalChunks: number;
  validChunks: number;
  totalSize: number;
  averageChunkSize: number;
} {
  let validChunks = 0;
  let totalSize = 0;
  
  for (const chunk of chunks) {
    if (hasAudioContent(chunk)) {
      validChunks++;
      totalSize += chunk.length;
    }
  }
  
  return {
    totalChunks: chunks.length,
    validChunks,
    totalSize,
    averageChunkSize: validChunks > 0 ? totalSize / validChunks : 0
  };
}
