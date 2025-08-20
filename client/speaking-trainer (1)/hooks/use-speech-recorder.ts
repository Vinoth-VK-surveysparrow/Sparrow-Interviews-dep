"use client"

import { useState, useRef, useCallback } from "react"

export interface SpeechRecorderState {
  isRecording: boolean
  isSupported: boolean
  audioLevel: number
  error: string | null
  duration: number
}

export interface SpeechRecorderActions {
  startRecording: () => Promise<void>
  stopRecording: () => Promise<Blob | null>
  resetRecording: () => void
}

export function useSpeechRecorder(): SpeechRecorderState & SpeechRecorderActions {
  const [isRecording, setIsRecording] = useState(false)
  const [isSupported, setIsSupported] = useState(true)
  const [audioLevel, setAudioLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)

    // Calculate average volume level
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
    const normalizedLevel = Math.min(average / 128, 1) // Normalize to 0-1

    setAudioLevel(normalizedLevel)

    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
    }
  }, [isRecording])

  const startRecording = useCallback(async () => {
    try {
      setError(null)

      // Check if browser supports MediaRecorder
      if (!navigator.mediaDevices || !window.MediaRecorder) {
        setIsSupported(false)
        setError("Your browser doesn't support audio recording")
        return
      }

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      })

      streamRef.current = stream
      chunksRef.current = []

      // Set up audio analysis for visual feedback
      audioContextRef.current = new AudioContext()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      source.connect(analyserRef.current)

      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4",
      })

      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.start(100) // Collect data every 100ms
      setIsRecording(true)
      setDuration(0)

      // Start duration timer
      intervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 0.1)
      }, 100)

      // Start audio level monitoring
      updateAudioLevel()
    } catch (err) {
      console.error("Error starting recording:", err)
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setError("Microphone permission denied. Please allow microphone access to use this feature.")
        } else if (err.name === "NotFoundError") {
          setError("No microphone found. Please connect a microphone and try again.")
        } else {
          setError("Failed to start recording. Please check your microphone and try again.")
        }
      }
    }
  }, [updateAudioLevel])

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !isRecording) {
        resolve(null)
        return
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mediaRecorderRef.current?.mimeType || "audio/webm",
        })
        resolve(blob)
      }

      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setAudioLevel(0)

      // Clean up
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }

      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }

      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }

      analyserRef.current = null
      mediaRecorderRef.current = null
    })
  }, [isRecording])

  const resetRecording = useCallback(() => {
    if (isRecording) {
      stopRecording()
    }
    setError(null)
    setDuration(0)
    setAudioLevel(0)
    chunksRef.current = []
  }, [isRecording, stopRecording])

  return {
    isRecording,
    isSupported,
    audioLevel,
    error,
    duration,
    startRecording,
    stopRecording,
    resetRecording,
  }
}
