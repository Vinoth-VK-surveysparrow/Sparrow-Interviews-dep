/**
 * Audio processing utilities for speech analysis
 */

export interface AudioAnalysis {
  duration: number
  averageVolume: number
  peakVolume: number
  silencePeriods: number[]
  energyLevels: number[]
}

export async function analyzeAudioBlob(audioBlob: Blob): Promise<AudioAnalysis> {
  return new Promise((resolve, reject) => {
    const audioContext = new AudioContext()
    const fileReader = new FileReader()

    fileReader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

        const channelData = audioBuffer.getChannelData(0)
        const sampleRate = audioBuffer.sampleRate
        const duration = audioBuffer.duration

        // Calculate volume levels
        let totalVolume = 0
        let peakVolume = 0
        const energyLevels: number[] = []
        const silencePeriods: number[] = []

        const windowSize = Math.floor(sampleRate * 0.1) // 100ms windows
        let silenceStart = -1

        for (let i = 0; i < channelData.length; i += windowSize) {
          const window = channelData.slice(i, i + windowSize)
          const rms = Math.sqrt(window.reduce((sum, sample) => sum + sample * sample, 0) / window.length)

          energyLevels.push(rms)
          totalVolume += rms
          peakVolume = Math.max(peakVolume, rms)

          // Detect silence periods (threshold: 0.01)
          if (rms < 0.01) {
            if (silenceStart === -1) {
              silenceStart = i / sampleRate
            }
          } else {
            if (silenceStart !== -1) {
              silencePeriods.push(i / sampleRate - silenceStart)
              silenceStart = -1
            }
          }
        }

        const averageVolume = totalVolume / energyLevels.length

        resolve({
          duration,
          averageVolume,
          peakVolume,
          silencePeriods,
          energyLevels,
        })
      } catch (error) {
        reject(error)
      }
    }

    fileReader.onerror = () => reject(new Error("Failed to read audio file"))
    fileReader.readAsArrayBuffer(audioBlob)
  })
}

export function calculateSpeechRate(audioAnalysis: AudioAnalysis, wordCount: number): number {
  const speakingTime = audioAnalysis.duration - audioAnalysis.silencePeriods.reduce((sum, period) => sum + period, 0)
  return speakingTime > 0 ? (wordCount / speakingTime) * 60 : 0 // words per minute
}

export function detectEnergyChanges(energyLevels: number[]): number[] {
  const changes: number[] = []
  const threshold = 0.02 // Minimum change to be considered significant

  for (let i = 1; i < energyLevels.length; i++) {
    const change = Math.abs(energyLevels[i] - energyLevels[i - 1])
    if (change > threshold) {
      changes.push(i * 0.1) // Convert to seconds
    }
  }

  return changes
}

export async function convertBlobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(",")[1]) // Remove data:audio/webm;base64, prefix
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
