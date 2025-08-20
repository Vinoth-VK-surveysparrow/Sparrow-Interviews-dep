"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Mic, MicOff, Square, AlertCircle } from "lucide-react"
import { useSpeechRecorder } from "@/hooks/use-speech-recorder"
import { cn } from "@/lib/utils"
import { useEffect, useImperativeHandle, forwardRef } from "react"

interface SpeechRecorderProps {
  onRecordingComplete?: (audioBlob?: Blob) => void
  onRecordingStart?: () => void
  onRecordingStop?: () => void
  disabled?: boolean
  className?: string
  showDuration?: boolean
  maxDuration?: number
  autoStart?: boolean
  isRecording?: boolean
}

export interface SpeechRecorderRef {
  stopRecording: () => Promise<void>
}

export const SpeechRecorder = forwardRef<SpeechRecorderRef, SpeechRecorderProps>(
  (
    {
      onRecordingComplete,
      onRecordingStart,
      onRecordingStop,
      disabled = false,
      className,
      showDuration = true,
      maxDuration,
      autoStart = false,
      isRecording: externalIsRecording,
    },
    ref,
  ) => {
    const { isRecording, isSupported, audioLevel, error, duration, startRecording, stopRecording, resetRecording } =
      useSpeechRecorder()

    const handleStartRecording = async () => {
      console.log("[v0] SpeechRecorder handleStartRecording called")
      await startRecording()
      onRecordingStart?.()
      console.log("[v0] SpeechRecorder recording started successfully")
    }

    const handleStopRecording = async () => {
      console.log("[v0] SpeechRecorder handleStopRecording called")
      const audioBlob = await stopRecording()
      console.log("[v0] SpeechRecorder got audio blob:", audioBlob?.size, "bytes")
      onRecordingStop?.()
      onRecordingComplete?.(audioBlob)
      console.log("[v0] SpeechRecorder onRecordingComplete called with blob")
    }

    useImperativeHandle(
      ref,
      () => ({
        stopRecording: async () => {
          console.log("[v0] SpeechRecorder direct stopRecording called via ref")
          await handleStopRecording()
        },
      }),
      [],
    )

    useEffect(() => {
      if (autoStart && !isRecording && !disabled) {
        console.log("[v0] SpeechRecorder autoStart triggered")
        handleStartRecording()
      }
    }, [autoStart, disabled, isRecording])

    useEffect(() => {
      console.log(
        "[v0] SpeechRecorder useEffect triggered - externalIsRecording:",
        externalIsRecording,
        "internal isRecording:",
        isRecording,
        "disabled:",
        disabled,
      )

      if (externalIsRecording !== undefined) {
        if (externalIsRecording && !isRecording && !disabled) {
          console.log("[v0] Auto-starting recording due to external prop")
          handleStartRecording()
        } else if (!externalIsRecording && isRecording) {
          console.log("[v0] Auto-stopping recording due to external prop")
          handleStopRecording()
        } else {
          console.log("[v0] No action needed - conditions not met")
        }
      } else {
        console.log("[v0] externalIsRecording is undefined")
      }
    }, [externalIsRecording, isRecording, disabled])

    const formatDuration = (seconds: number) => {
      const mins = Math.floor(seconds / 60)
      const secs = Math.floor(seconds % 60)
      return `${mins}:${secs.toString().padStart(2, "0")}`
    }

    if (maxDuration && duration >= maxDuration && isRecording) {
      handleStopRecording()
    }

    if (!isSupported) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your browser doesn't support audio recording. Please use a modern browser like Chrome, Firefox, or Safari.
          </AlertDescription>
        </Alert>
      )
    }

    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <div className="flex items-center justify-center">
                <div
                  className={cn(
                    "relative flex h-20 w-20 items-center justify-center rounded-full border-4 transition-all duration-150",
                    isRecording ? "border-primary bg-primary/10 animate-pulse" : "border-muted bg-muted/50",
                  )}
                  style={{
                    transform: isRecording ? `scale(${1 + audioLevel * 0.3})` : "scale(1)",
                    boxShadow: isRecording ? `0 0 ${audioLevel * 30}px rgba(190, 18, 60, 0.3)` : "none",
                  }}
                >
                  {isRecording ? (
                    <Mic className="h-8 w-8 text-primary" />
                  ) : (
                    <MicOff className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
              </div>

              {isRecording && (
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-1 bg-primary rounded-full transition-all duration-100",
                        audioLevel > i * 0.2 ? "h-3" : "h-1 opacity-30",
                      )}
                    />
                  ))}
                </div>
              )}
            </div>

            {showDuration && (
              <div className="text-center">
                <div className="text-2xl font-mono font-bold text-foreground">{formatDuration(duration)}</div>
                {maxDuration && <div className="text-sm text-muted-foreground">/ {formatDuration(maxDuration)}</div>}
              </div>
            )}

            <div className="flex space-x-3">
              {!isRecording ? (
                <Button onClick={handleStartRecording} disabled={disabled} size="lg" className="px-8">
                  <Mic className="h-4 w-4 mr-2" />
                  Start Recording
                </Button>
              ) : (
                <Button onClick={handleStopRecording} variant="destructive" size="lg" className="px-8">
                  <Square className="h-4 w-4 mr-2" />
                  Stop Recording
                </Button>
              )}

              {(duration > 0 || error) && (
                <Button onClick={resetRecording} variant="outline" size="lg" disabled={isRecording}>
                  Reset
                </Button>
              )}
            </div>

            {error && (
              <Alert variant="destructive" className="w-full">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {isRecording && (
              <div className="text-center">
                <div className="flex items-center justify-center space-x-2 text-sm text-primary">
                  <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                  <span className="font-medium">Recording in progress...</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Speak clearly into your microphone</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  },
)

SpeechRecorder.displayName = "SpeechRecorder"
