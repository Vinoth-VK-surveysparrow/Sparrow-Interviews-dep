"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, Zap, Clock, Target, RotateCcw, Mic, MicOff, Plus, Minus } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface GameSettings {
  promptCount: number
  timePerPrompt: number
  difficulty: "beginner" | "intermediate" | "advanced"
}

interface GameResult {
  totalPrompts: number
  completedPrompts: number
  averageResponseTime: number
  responseRate: number
  missedPrompts: string[]
  aiScore?: number
  feedback?: string
  improvements?: string[]
}

type GameState = "setup" | "playing" | "feedback"

const ANALOGY_PROMPTS = [
  "Business is like",
  "Love is like",
  "Success is like",
  "Life is like",
  "Learning is like",
  "Friendship is like",
  "Time is like",
  "Money is like",
  "Dreams are like",
  "Failure is like",
  "Creativity is like",
  "Leadership is like",
  "Change is like",
  "Trust is like",
  "Growth is like",
  "Communication is like",
  "Innovation is like",
  "Teamwork is like",
  "Courage is like",
  "Wisdom is like",
  "Opportunity is like",
  "Challenge is like",
  "Progress is like",
  "Balance is like",
  "Focus is like",
]

const DIFFICULTY_PRESETS: Record<string, GameSettings> = {
  beginner: { promptCount: 5, timePerPrompt: 5, difficulty: "beginner" },
  intermediate: { promptCount: 15, timePerPrompt: 3, difficulty: "intermediate" },
  advanced: { promptCount: 20, timePerPrompt: 2, difficulty: "advanced" },
}

export default function RapidFirePage() {
  const [gameState, setGameState] = useState<GameState>("setup")
  const [settings, setSettings] = useState<GameSettings>(DIFFICULTY_PRESETS.beginner)
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [gamePrompts, setGamePrompts] = useState<string[]>([])
  const [responses, setResponses] = useState<boolean[]>([])
  const [responseTimes, setResponseTimes] = useState<number[]>([])
  const [gameResult, setGameResult] = useState<GameResult | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [audioChunkCount, setAudioChunkCount] = useState(0)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const recordingStartTimeRef = useRef<number>(0)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const gameStartTimeRef = useRef<number>(0)
  const currentPromptStartRef = useRef<number>(0)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

  const startRecording = async () => {
    try {
      console.log("[v0] RECORDING: Starting MediaRecorder")
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)
      analyser.fftSize = 256
      audioContextRef.current = audioContext
      analyserRef.current = analyser

      let mimeType = "audio/webm" // fallback
      let fileExtension = "webm"

      // Try basic audio/ogg first (more widely supported than with codecs)
      if (MediaRecorder.isTypeSupported("audio/ogg")) {
        mimeType = "audio/ogg"
        fileExtension = "ogg"
        console.log("[v0] RECORDING: Using audio/ogg format for Gemini compatibility")
      } else if (MediaRecorder.isTypeSupported("audio/ogg; codecs=opus")) {
        mimeType = "audio/ogg; codecs=opus"
        fileExtension = "ogg"
        console.log("[v0] RECORDING: Using audio/ogg with opus codec for Gemini compatibility")
      } else if (MediaRecorder.isTypeSupported("audio/mpeg")) {
        mimeType = "audio/mpeg"
        fileExtension = "mp3"
        console.log("[v0] RECORDING: Using audio/mpeg (mp3) format for Gemini compatibility")
      } else {
        console.log(
          "[v0] RECORDING: No Gemini-supported formats available, using fallback audio/webm (may not work with Gemini)",
        )
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      setAudioChunkCount(0)
      setRecordingDuration(0)
      recordingStartTimeRef.current = Date.now()

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
          setAudioChunkCount(audioChunksRef.current.length)
          console.log("[v0] RECORDING: Audio chunk received, size:", event.data.size)
        }
      }

      mediaRecorder.onstop = () => {
        console.log("[v0] RECORDING: MediaRecorder stopped, total chunks:", audioChunksRef.current.length)
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        console.log("[v0] RECORDING: Created audio blob, size:", audioBlob.size, "type:", mimeType)

        if (audioContextRef.current) {
          audioContextRef.current.close()
          audioContextRef.current = null
        }
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current)
          recordingTimerRef.current = null
        }

        if (audioBlob.size > 0) {
          console.log("[v0] RECORDING: Audio successfully saved, sending for analysis")
          analyzeWithAI(audioBlob, fileExtension)
        } else {
          console.error("[v0] RECORDING: Audio blob is empty")
          setIsAnalyzing(false)
        }
      }

      mediaRecorder.start(1000) // Collect data every second
      setIsRecording(true)

      recordingTimerRef.current = setInterval(() => {
        const duration = (Date.now() - recordingStartTimeRef.current) / 1000
        setRecordingDuration(duration)

        // Update audio level visualization
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
          analyserRef.current.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
          setAudioLevel(average / 255) // Normalize to 0-1
        }
      }, 100)

      console.log("[v0] RECORDING: MediaRecorder started successfully with format:", mimeType)
    } catch (error) {
      console.error("[v0] RECORDING: Failed to start recording:", error)
    }
  }

  const stopRecording = () => {
    console.log("[v0] RECORDING: Stopping MediaRecorder")
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    setIsRecording(false)
  }

  const generateGamePrompts = (count: number) => {
    const shuffled = [...ANALOGY_PROMPTS].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count)
  }

  const startGame = async () => {
    const prompts = generateGamePrompts(settings.promptCount)
    setGamePrompts(prompts)
    setCurrentPromptIndex(0)
    setResponses([])
    setResponseTimes([])
    setGameState("playing")
    setTimeRemaining(settings.timePerPrompt)

    console.log("[v0] Starting game with direct MediaRecorder")

    await startRecording()

    gameStartTimeRef.current = Date.now()
    currentPromptStartRef.current = Date.now()
  }

  useEffect(() => {
    if (gameState !== "playing") return

    if (timerRef.current) clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      setTimeRemaining((prevTime) => {
        const newTime = prevTime - 0.1

        if (newTime <= 0) {
          const responseTime = (Date.now() - currentPromptStartRef.current) / 1000

          setResponseTimes((prev) => [...prev, responseTime])

          setCurrentPromptIndex((prevIndex) => {
            const nextIndex = prevIndex + 1

            if (nextIndex >= settings.promptCount) {
              console.log("[v0] Game complete - ending")
              return prevIndex
            } else {
              console.log(`[v0] Moving to prompt ${nextIndex + 1} of ${settings.promptCount}`)
              currentPromptStartRef.current = Date.now()
              return nextIndex
            }
          })

          return settings.timePerPrompt
        }

        return newTime
      })
    }, 100)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [gameState, settings.promptCount, settings.timePerPrompt])

  useEffect(() => {
    if (
      gameState === "playing" &&
      currentPromptIndex >= settings.promptCount - 1 &&
      responseTimes.length >= settings.promptCount
    ) {
      console.log("[v0] Game ending detected - stopping recording and analyzing")
      endGame()
    }
  }, [gameState, currentPromptIndex, settings.promptCount, responseTimes.length])

  const endGame = async () => {
    console.log("[v0] GAME: endGame function called")

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
      console.log("[v0] GAME: Timer cleared")
    }

    setIsAnalyzing(true)
    stopRecording()

    const basicResult = {
      totalPrompts: settings.promptCount,
      completedPrompts: 0, // Will be updated by Gemini analysis
      averageResponseTime:
        responseTimes.length > 0 ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0,
      responseRate: 0, // Will be updated by Gemini analysis
      missedPrompts: [], // Will be updated by Gemini analysis
    }

    console.log("[v0] GAME: Basic result calculated:", basicResult)
    setGameResult(basicResult)
    setGameState("feedback")
  }

  const analyzeWithAI = async (audioBlob: Blob, fileExtension: string) => {
    try {
      console.log("[v0] GEMINI: Starting AI analysis with audio blob size:", audioBlob.size, "type:", audioBlob.type)

      const formData = new FormData()
      formData.append("audio", audioBlob, `game-audio.${fileExtension}`)
      formData.append(
        "gameData",
        JSON.stringify({
          prompts: gamePrompts,
          totalPrompts: settings.promptCount,
          responseTimes: responseTimes,
          settings: settings,
        }),
      )

      console.log("[v0] GEMINI: Sending request to /api/analyze-speech")
      const response = await fetch("/api/analyze-speech", {
        method: "POST",
        body: formData,
      })

      console.log("[v0] GEMINI: Response status:", response.status)

      if (response.ok) {
        const analysisResult = await response.json()
        console.log("[v0] GEMINI: Analysis result:", analysisResult)

        const responseRate =
          analysisResult.scoring_summary?.actual_response_rate || analysisResult.actual_response_rate || 0
        const completedPrompts =
          analysisResult.scoring_summary?.prompts_with_responses ||
          Math.round((responseRate * settings.promptCount) / 100)
        const missedPrompts = analysisResult.scoring_summary?.prompts_silent || settings.promptCount - completedPrompts

        setGameResult((prev) => ({
          ...prev!,
          responseRate: responseRate,
          completedPrompts: completedPrompts,
          missedPrompts: Array(missedPrompts).fill("Silent"), // Create array of missed prompts
          aiScore: analysisResult.confidence_score || 50,
          feedback: analysisResult.specific_feedback || "Keep practicing your response rate and confidence!",
          improvements: analysisResult.next_steps || [
            "Practice speaking without overthinking",
            "Focus on quick responses",
          ],
        }))
        console.log("[v0] GEMINI: Game result updated with AI analysis")
      } else {
        const errorText = await response.text()
        console.error("[v0] GEMINI: AI analysis failed:", response.status, errorText)
      }
    } catch (error) {
      console.error("[v0] GEMINI: AI analysis failed:", error)
    } finally {
      setIsAnalyzing(false)
      console.log("[v0] GEMINI: Analysis complete")
    }
  }

  const resetGame = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    audioChunksRef.current = []

    setGameState("setup")
    setCurrentPromptIndex(0)
    setTimeRemaining(0)
    setGamePrompts([])
    setResponses([])
    setResponseTimes([])
    setGameResult(null)
    setIsRecording(false)
    setIsAnalyzing(false)
  }

  if (gameState === "setup") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
        <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="hover:bg-muted/50">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-lg">
                  <Zap className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold font-serif bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Rapid Fire Analogies
                  </h1>
                  <p className="text-muted-foreground">Build confidence through quick thinking</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="max-w-3xl mx-auto mb-8"></div>

              {/* Primary CTA - Most prominent element */}
              <div className="mb-12">
                <Button
                  onClick={startGame}
                  size="lg"
                  className="px-16 py-8 text-2xl font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105 border-0"
                >
                  Start Training
                </Button>
              </div>
            </div>

            <Card className="shadow-xl border-0 bg-card/90 backdrop-blur-sm mb-8">
              <CardContent className="space-y-8">
                <div className="space-y-6">
                  <div className="text-center"></div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(DIFFICULTY_PRESETS).map(([key, preset]) => (
                      <Card
                        key={key}
                        className={cn(
                          "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 border-2",
                          settings.difficulty === key
                            ? "ring-2 ring-primary bg-gradient-to-br from-primary/10 to-accent/10 border-primary shadow-lg"
                            : "border-border hover:border-primary/50",
                        )}
                        onClick={() => setSettings(preset)}
                      >
                        <CardContent className="p-6 text-center">
                          <div className="mb-4">
                            <div
                              className={cn(
                                "w-12 h-12 mx-auto rounded-full flex items-center justify-center text-white font-bold text-lg",
                                key === "beginner" && "bg-gradient-to-br from-accent to-accent/80",
                                key === "intermediate" && "bg-gradient-to-br from-primary to-primary/80",
                                key === "advanced" && "bg-gradient-to-br from-chart-1 to-chart-1/80",
                              )}
                            >
                              {key === "beginner" && "B"}
                              {key === "intermediate" && "I"}
                              {key === "advanced" && "A"}
                            </div>
                          </div>
                          <h4 className="font-bold text-lg capitalize mb-3">{key}</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Prompts:</span>
                              <span className="font-bold">{preset.promptCount}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Time each:</span>
                              <span className="font-bold">{preset.timePerPrompt}s</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Total:</span>
                              <span className="font-bold">
                                {Math.floor((preset.promptCount * preset.timePerPrompt) / 60)}m
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <details className="group">
                  <summary className="flex cursor-pointer items-center justify-between py-4 text-primary hover:text-primary/80">
                    <span className="font-medium">▶ Advanced Settings</span>
                    <span className="text-xs text-muted-foreground group-open:hidden">Customize your challenge</span>
                  </summary>
                  <div className="space-y-6 pt-4">
                    <div className="grid gap-6">
                      <Card className="p-6 bg-muted/30">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <label className="font-medium">Number of Prompts</label>
                            <div className="flex items-center gap-3">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setSettings((prev) => ({
                                    ...prev,
                                    promptCount: Math.max(5, prev.promptCount - 1),
                                    difficulty: "beginner",
                                  }))
                                }
                                disabled={settings.promptCount <= 5}
                                className="h-8 w-8 p-0"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <div className="w-16 text-center">
                                <span className="text-2xl font-bold text-primary">{settings.promptCount}</span>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setSettings((prev) => ({
                                    ...prev,
                                    promptCount: Math.min(25, prev.promptCount + 1),
                                    difficulty: "beginner",
                                  }))
                                }
                                disabled={settings.promptCount >= 25}
                                className="h-8 w-8 p-0"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground text-center">Range: 5-25 prompts</div>
                        </div>
                      </Card>

                      <Card className="p-6 bg-muted/30">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <label className="font-medium">Time per Prompt</label>
                            <div className="flex items-center gap-3">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setSettings((prev) => ({
                                    ...prev,
                                    timePerPrompt: Math.max(1, prev.timePerPrompt - 0.5),
                                    difficulty: "beginner",
                                  }))
                                }
                                disabled={settings.timePerPrompt <= 1}
                                className="h-8 w-8 p-0"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <div className="w-16 text-center">
                                <span className="text-2xl font-bold text-primary">{settings.timePerPrompt}s</span>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setSettings((prev) => ({
                                    ...prev,
                                    timePerPrompt: Math.min(8, prev.timePerPrompt + 0.5),
                                    difficulty: "beginner",
                                  }))
                                }
                                disabled={settings.timePerPrompt >= 8}
                                className="h-8 w-8 p-0"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground text-center">Range: 1-8 seconds</div>
                        </div>
                      </Card>
                    </div>
                  </div>
                </details>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (gameState === "playing") {
    const progress = ((currentPromptIndex + 1) / settings.promptCount) * 100
    const currentPrompt = gamePrompts[currentPromptIndex]

    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-chart-1/10 text-chart-1">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold font-serif">Rapid Fire Analogies</h1>
                  <p className="text-sm text-muted-foreground">
                    {currentPromptIndex + 1} of {settings.promptCount}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-chart-1 text-white">
                <Clock className="h-3 w-3 mr-1" />
                {timeRemaining.toFixed(1)}s
              </Badge>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <Progress value={progress} className="h-2" />
            </div>

            <div className="text-center mb-8">
              <div className="text-6xl font-bold font-serif text-foreground mb-4">
                {currentPrompt} <span className="text-primary">--</span>
              </div>
              <p className="text-lg text-muted-foreground">Complete this analogy by speaking immediately!</p>
            </div>

            <div className="flex justify-center mb-8">
              <div className="flex items-center gap-4 p-4 bg-card border rounded-lg">
                {isRecording ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      <Mic className="h-5 w-5 text-red-500" />
                      <span className="text-sm font-medium">Recording...</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span>Duration:</span>
                        <span className="font-mono">
                          {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toFixed(0).padStart(2, "0")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Chunks:</span>
                        <span className="font-mono text-green-600">{audioChunkCount}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Level:</span>
                        <div className="w-8 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 transition-all duration-100"
                            style={{ width: `${audioLevel * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <MicOff className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Not recording</span>
                  </>
                )}
              </div>
            </div>

            <div className="text-center">
              <p className="text-muted-foreground">
                {isRecording ? "Recording continuously - speak your analogy when ready!" : "Get ready to speak..."}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Prompt {currentPromptIndex + 1} of {settings.promptCount} • {timeRemaining.toFixed(1)}s remaining
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (gameState === "feedback" && gameResult) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Home
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-chart-1/10 text-chart-1">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold font-serif">Game Complete!</h1>
                  <p className="text-sm text-muted-foreground">Here's how you did</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-chart-2 mb-2">{gameResult.responseRate.toFixed(0)}%</div>
                  <div className="text-sm text-muted-foreground">Response Rate</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {gameResult.completedPrompts} of {gameResult.totalPrompts} prompts
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-chart-1 mb-2">
                    {gameResult.averageResponseTime.toFixed(1)}s
                  </div>
                  <div className="text-sm text-muted-foreground">Avg Response Time</div>
                  <div className="text-xs text-muted-foreground mt-1">Faster = better flow</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-chart-3 mb-2">{gameResult.missedPrompts.length}</div>
                  <div className="text-sm text-muted-foreground">Missed Prompts</div>
                  <div className="text-xs text-muted-foreground mt-1">Keep practicing!</div>
                </CardContent>
              </Card>
            </div>

            {isAnalyzing && (
              <Card className="mb-8">
                <CardContent className="p-6 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Analyzing your performance with AI...</p>
                </CardContent>
              </Card>
            )}

            {gameResult.aiScore && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="font-serif flex items-center gap-2">
                    AI Performance Analysis
                    <Badge variant="secondary">{gameResult.aiScore}/100</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {gameResult.feedback && (
                      <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                        <p className="text-sm">{gameResult.feedback}</p>
                      </div>
                    )}

                    {gameResult.improvements && gameResult.improvements.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Personalized Improvements:</h4>
                        <ul className="space-y-1">
                          {gameResult.improvements.map((improvement, index) => (
                            <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                              <span className="text-primary">•</span>
                              {improvement}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {!isAnalyzing && gameResult.aiScore && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="font-serif">Performance Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {gameResult.responseRate >= 80 && (
                      <div className="p-4 bg-chart-2/10 border border-chart-2/20 rounded-lg">
                        <h4 className="font-semibold text-chart-2 mb-2">Excellent Flow! 🎉</h4>
                        <p className="text-sm text-muted-foreground">
                          You responded to most prompts quickly. This shows great confidence and improvisation skills.
                          Keep building on this momentum!
                        </p>
                      </div>
                    )}

                    {gameResult.responseRate >= 50 && gameResult.responseRate < 80 && (
                      <div className="p-4 bg-chart-1/10 border border-chart-1/20 rounded-lg">
                        <h4 className="font-semibold text-chart-1 mb-2">Good Progress! 👍</h4>
                        <p className="text-sm text-muted-foreground">
                          You're getting the hang of quick responses. Try to trust your first instinct more and don't
                          worry about perfect answers.
                        </p>
                      </div>
                    )}

                    {gameResult.responseRate < 50 && (
                      <div className="p-4 bg-chart-3/10 border border-chart-3/20 rounded-lg">
                        <h4 className="font-semibold text-chart-3 mb-2">Keep Practicing! 💪</h4>
                        <p className="text-sm text-muted-foreground">
                          Don't worry about being perfect. The goal is to speak without overthinking. Try starting with
                          easier settings and focus on saying anything that comes to mind.
                        </p>
                      </div>
                    )}

                    {gameResult.averageResponseTime < 2 && (
                      <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                        <h4 className="font-semibold text-primary mb-2">Lightning Fast! ⚡</h4>
                        <p className="text-sm text-muted-foreground">
                          Your quick response time shows excellent instinctive thinking. This skill will serve you well
                          in real conversations and presentations.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={resetGame} size="lg" className="px-8">
                <RotateCcw className="h-4 w-4 mr-2" />
                Play Again
              </Button>
              <Link href="/games/conductor">
                <Button variant="outline" size="lg" className="px-8 bg-transparent">
                  Try Next Game
                </Button>
              </Link>
              <Link href="/">
                <Button variant="ghost" size="lg" className="px-8">
                  Back to Home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
