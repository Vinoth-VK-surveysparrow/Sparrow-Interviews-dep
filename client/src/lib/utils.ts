import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function blobToJSON(blob: Blob): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = JSON.parse(reader.result as string);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function audioContext(
  options: { sampleRate?: number; id?: string } = {}
): Promise<AudioContext> {
  const { sampleRate = 24000, id = "default" } = options;
  
  // Create or get existing context
  const context = new AudioContext({ sampleRate });
  
  // Resume if suspended
  if (context.state === "suspended") {
    await context.resume();
  }
  
  return context;
}