"use client"

import { useState } from "react"
import type { AIFeedback, GamePerformanceData } from "@/lib/ai-scoring"

export function useAIFeedback() {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [feedback, setFeedback] = useState<AIFeedback | null>(null)
  const [error, setError] = useState<string | null>(null)

  const analyzeSpeech = async (
    audioBlob: Blob | null,
    gameData: Omit<GamePerformanceData, "audioBlob" | "audioAnalysis">,
  ) => {
    setIsAnalyzing(true)
    setError(null)

    try {
      const formData = new FormData()
      if (audioBlob) {
        formData.append("audio", audioBlob)
      }
      formData.append("gameData", JSON.stringify(gameData))

      const response = await fetch("/api/analyze-speech", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Analysis failed")
      }

      const result = await response.json()
      setFeedback(result)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Analysis failed"
      setError(errorMessage)
      throw err
    } finally {
      setIsAnalyzing(false)
    }
  }

  const reset = () => {
    setFeedback(null)
    setError(null)
    setIsAnalyzing(false)
  }

  return {
    analyzeSpeech,
    isAnalyzing,
    feedback,
    error,
    reset,
  }
}
