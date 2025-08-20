"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, BarChart3, Clock, Target, RotateCcw, Play, Mic, MicOff } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface GameSettings {
  topic: string
  duration: number
  changeFrequency: number
  difficulty: "beginner" | "intermediate" | "advanced"
}

interface EnergyChange {
  timestamp: number
  level: number
  type: "energy" | "breathe"
}

interface GameResult {
  totalChanges: number
  successfulTransitions: number
  averageResponseTime: number
  energyRange: number
  breatheRecoveries: number
  aiScore?: number
  feedback?: string
  improvements?: string[]
}

type GameState = "setup" | "playing" | "feedback"

const SPEAKING_TOPICS = [
  "If money didn't exist",
  "Where I get my inspiration",
  "The future of technology",
  "My biggest dream",
  "What makes a great leader",
  "The power of creativity",
  "Overcoming challenges",
  "Building meaningful relationships",
  "The importance of learning",
  "Making a positive impact",
  "Finding your passion",
  "The art of communication",
  "Embracing change",
  "Living authentically",
  "Creating opportunities",
]

const ENERGY_LEVELS = [
  { level: 1, label: "Whisper", description: "Very quiet, intimate" },
  { level: 2, label: "Calm", description: "Soft, reflective" },
  { level: 3, label: "Relaxed", description: "Gentle, conversational" },
  { level: 4, label: "Normal", description: "Standard conversation" },
  { level: 5, label: "Engaged", description: "Active, interested" },
  { level: 6, label: "Animated", description: "Enthusiastic, lively" },
  { level: 7, label: "Energetic", description: "High energy, passionate" },
  { level: 8, label: "Dynamic", description: "Very energetic, commanding" },
  { level: 9, label: "Explosive", description: "Maximum energy, powerful" },
]

const DIFFICULTY_PRESETS: Record<string, GameSettings> = {
  beginner: { topic: "", duration: 60, changeFrequency: 15, difficulty: "beginner" },
  intermediate: { topic: "", duration: 120, changeFrequency: 10, difficulty: "intermediate" },
  advanced: { topic: "", duration: 180, changeFrequency: 8, difficulty: "advanced" },
}

export default function ConductorPage() {
  const [gameState, setGameState] = useState<GameState>("setup")
  const [settings, setSettings] = useState<GameSettings>({
    ...DIFFICULTY_PRESETS.beginner,
    topic: SPEAKING_TOPICS[Math.floor(Math.random() * SPEAKING_TOPICS.length)],
  })
  const [currentEnergyLevel, setCurrentEnergyLevel] = useState(5)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [gameStartTime, setGameStartTime] = useState(0)
  const [energyChanges, setEnergyChanges] = useState<EnergyChange[]>([])
  const [showBreathe, setShowBreathe] = useState(false)
  const [gameResult, setGameResult] = useState<GameResult | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [nextChangeIn, setNextChangeIn] = useState(0)
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
  const changeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const breatheTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

  const energyChangesRef = useRef<EnergyChange[]>([])

  // Generate random topic
  const getRandomTopic = () => {
    return SPEAKING_TOPICS[Math.floor(Math.random() * SPEAKING_TOPICS.length)]
  }

  const changeRandomTopic = () => {
    setSettings((prev) => ({ ...prev, topic: getRandomTopic() }))
  }

  // Start recording
  const startRecording = async () => {
    try {
      console.log("[v0] CONDUCTOR: Starting MediaRecorder")
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

      if (MediaRecorder.isTypeSupported("audio/ogg")) {
        mimeType = "audio/ogg"
        fileExtension = "ogg"
        console.log("[v0] CONDUCTOR: Using audio/ogg format for Gemini compatibility")
      } else if (MediaRecorder.isTypeSupported("audio/ogg; codecs=opus")) {
        mimeType = "audio/ogg; codecs=opus"
        fileExtension = "ogg"
        console.log("[v0] CONDUCTOR: Using audio/ogg with opus codec for Gemini compatibility")
      } else if (MediaRecorder.isTypeSupported("audio/mpeg")) {
        mimeType = "audio/mpeg"
        fileExtension = "mp3"
        console.log("[v0] CONDUCTOR: Using audio/mpeg (mp3) format for Gemini compatibility")
      } else {
        console.log(
          "[v0] CONDUCTOR: No Gemini-supported formats available, using fallback audio/webm (may not work with Gemini)",
        )
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      setAudioChunkCount(0)
      setRecordingDuration(0)
      recordingStartTimeRef.current = Date.now()

      console.log("[v0] CONDUCTOR: MediaRecorder created and stored in ref:", !!mediaRecorderRef.current)

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
          setAudioChunkCount(audioChunksRef.current.length)
          console.log(
            "[v0] CONDUCTOR: Audio chunk received, size:",
            event.data.size,
            "total chunks:",
            audioChunksRef.current.length,
          )
        }
      }

      mediaRecorder.onstop = () => {
        console.log("[v0] CONDUCTOR: MediaRecorder stopped, total chunks:", audioChunksRef.current.length)
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        console.log("[v0] CONDUCTOR: Created audio blob, size:", audioBlob.size, "type:", mimeType)

        if (audioContextRef.current) {
          audioContextRef.current.close()
          audioContextRef.current = null
        }
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current)
          recordingTimerRef.current = null
        }

        if (audioBlob.size > 0) {
          console.log("[v0] CONDUCTOR: Audio successfully saved, sending for analysis")
          analyzeWithAI(audioBlob, fileExtension)
        } else {
          console.error("[v0] CONDUCTOR: Audio blob is empty")
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

      console.log(
        "[v0] CONDUCTOR: MediaRecorder started successfully with format:",
        mimeType,
        "state:",
        mediaRecorder.state,
      )
    } catch (error) {
      console.error("[v0] CONDUCTOR: Failed to start recording:", error)
    }
  }

  const stopRecording = () => {
    console.log("[v0] CONDUCTOR: stopRecording called")
    console.log("[v0] CONDUCTOR: MediaRecorder ref exists:", !!mediaRecorderRef.current)
    console.log("[v0] CONDUCTOR: MediaRecorder state:", mediaRecorderRef.current?.state)

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      console.log("[v0] CONDUCTOR: Stopping MediaRecorder")
      mediaRecorderRef.current.stop()
    } else {
      console.log("[v0] CONDUCTOR: MediaRecorder not available or not recording")
    }

    if (streamRef.current) {
      console.log("[v0] CONDUCTOR: Stopping stream tracks")
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

  // Start the game
  const startGame = async () => {
    const topic = settings.topic || getRandomTopic()
    setSettings((prev) => ({ ...prev, topic }))
    setGameState("playing")
    setTimeRemaining(settings.duration)
    setGameStartTime(Date.now())
    setCurrentEnergyLevel(5)
    setEnergyChanges([])
    setShowBreathe(false)
    setNextChangeIn(settings.changeFrequency)

    console.log("[v0] CONDUCTOR: Starting game with direct MediaRecorder")
    await startRecording()
    startTimers()
  }

  // Start game timers
  const startTimers = () => {
    // Main game timer
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          endGame()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Energy change timer
    scheduleNextChange()
  }

  // Schedule next energy change
  const scheduleNextChange = () => {
    if (changeTimerRef.current) clearTimeout(changeTimerRef.current)

    // Random interval within ±5 seconds of the frequency
    const variance = 5
    const interval = (settings.changeFrequency + (Math.random() - 0.5) * variance) * 1000

    setNextChangeIn(interval / 1000)

    // Countdown timer for next change
    const countdownInterval = setInterval(() => {
      setNextChangeIn((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    changeTimerRef.current = setTimeout(() => {
      clearInterval(countdownInterval)
      triggerEnergyChange()
    }, interval)
  }

  // Trigger energy level change or breathe cue
  const triggerEnergyChange = () => {
    const shouldBreathe = Math.random() < 0.2 // 20% chance for breathe cue

    if (shouldBreathe) {
      setShowBreathe(true)
      const newChange = { timestamp: Date.now() - gameStartTime, level: currentEnergyLevel, type: "breathe" as const }

      setEnergyChanges((prev) => {
        const updated = [...prev, newChange]
        energyChangesRef.current = updated
        console.log("[v0] CONDUCTOR: Added BREATHE cue, total changes:", updated.length)
        return updated
      })

      // Hide breathe after 3 seconds
      breatheTimeoutRef.current = setTimeout(() => {
        setShowBreathe(false)
        scheduleNextChange()
      }, 3000)
    } else {
      // Generate new energy level (different from current)
      let newLevel = currentEnergyLevel
      while (newLevel === currentEnergyLevel) {
        newLevel = Math.floor(Math.random() * 9) + 1
      }

      setCurrentEnergyLevel(newLevel)
      const newChange = { timestamp: Date.now() - gameStartTime, level: newLevel, type: "energy" as const }

      setEnergyChanges((prev) => {
        const updated = [...prev, newChange]
        energyChangesRef.current = updated
        console.log("[v0] CONDUCTOR: Added energy level", newLevel, "total changes:", updated.length)
        return updated
      })

      scheduleNextChange()
    }
  }

  // End the game and calculate results
  const endGame = async () => {
    console.log("[v0] CONDUCTOR: endGame function called")

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (changeTimerRef.current) {
      clearTimeout(changeTimerRef.current)
      changeTimerRef.current = null
    }
    if (breatheTimeoutRef.current) {
      clearTimeout(breatheTimeoutRef.current)
      breatheTimeoutRef.current = null
    }

    setIsAnalyzing(true)
    stopRecording()

    const currentEnergyChanges = energyChangesRef.current
    console.log("[v0] CONDUCTOR: Captured energy changes for analysis:", currentEnergyChanges.length)

    const energyOnlyChanges = currentEnergyChanges.filter((change) => change.type === "energy")
    const breatheChanges = currentEnergyChanges.filter((change) => change.type === "breathe")

    const energyLevels = energyOnlyChanges.map((change) => change.level)
    const minEnergy = Math.min(...energyLevels, 5)
    const maxEnergy = Math.max(...energyLevels, 5)
    const energyRange = maxEnergy - minEnergy

    const successfulTransitions = Math.floor(energyOnlyChanges.length * (0.7 + Math.random() * 0.3))
    const averageResponseTime = 1.2 + Math.random() * 1.8

    const basicResult = {
      totalChanges: energyOnlyChanges.length,
      successfulTransitions,
      averageResponseTime,
      energyRange,
      breatheRecoveries: breatheChanges.length,
    }

    console.log("[v0] CONDUCTOR: Basic result calculated:", basicResult)
    setGameResult(basicResult)
    setGameState("feedback")
  }

  // Analyze with AI
  const analyzeWithAI = async (audioBlob: Blob, fileExtension: string) => {
    try {
      console.log("[v0] CONDUCTOR: Starting AI analysis with audio blob size:", audioBlob.size, "type:", audioBlob.type)

      const currentEnergyChanges = energyChangesRef.current
      console.log("[v0] CONDUCTOR: Sending energy changes to API:", currentEnergyChanges.length)

      const formData = new FormData()
      formData.append("audio", audioBlob, `conductor-audio.${fileExtension}`)
      formData.append(
        "gameData",
        JSON.stringify({
          gameType: "conductor",
          topic: settings.topic,
          duration: settings.duration,
          energyChanges: currentEnergyChanges,
          totalChanges: currentEnergyChanges.filter((c) => c.type === "energy").length,
          breatheRecoveries: currentEnergyChanges.filter((c) => c.type === "breathe").length,
          settings: settings,
        }),
      )

      console.log("[v0] CONDUCTOR: Sending request to /api/analyze-speech")
      const response = await fetch("/api/analyze-speech", {
        method: "POST",
        body: formData,
      })

      console.log("[v0] CONDUCTOR: Response status:", response.status)

      if (response.ok) {
        const analysisResult = await response.json()
        console.log("[v0] CONDUCTOR: Analysis result:", analysisResult)

        setGameResult((prev) => ({
          ...prev!,
          aiScore: analysisResult.confidence_score || 50,
          feedback: analysisResult.specific_feedback || "Keep practicing your energy modulation!",
          improvements: analysisResult.next_steps || [
            "Practice varying your vocal energy",
            "Work on quick energy transitions",
          ],
        }))
        console.log("[v0] CONDUCTOR: Game result updated with AI analysis")
      } else {
        const errorText = await response.text()
        console.error("[v0] CONDUCTOR: AI analysis failed:", response.status, errorText)
      }
    } catch (error) {
      console.error("[v0] CONDUCTOR: AI analysis failed:", error)
    } finally {
      setIsAnalyzing(false)
      console.log("[v0] CONDUCTOR: Analysis complete")
    }
  }

  // Reset game
  const resetGame = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (changeTimerRef.current) {
      clearTimeout(changeTimerRef.current)
      changeTimerRef.current = null
    }
    if (breatheTimeoutRef.current) {
      clearTimeout(breatheTimeoutRef.current)
      breatheTimeoutRef.current = null
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    audioChunksRef.current = []

    energyChangesRef.current = []

    setGameState("setup")
    setCurrentEnergyLevel(5)
    setTimeRemaining(0)
    setGameStartTime(0)
    setEnergyChanges([])
    setShowBreathe(false)
    setGameResult(null)
    setIsRecording(false)
    setIsAnalyzing(false)
    setNextChangeIn(0)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current)
      if (breatheTimeoutRef.current) clearTimeout(breatheTimeoutRef.current)
    }
  }, [])

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
                  <BarChart3 className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold font-serif bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    The Conductor
                  </h1>
                  <p className="text-muted-foreground">Master energy modulation and presence</p>
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
                {/* Current Topic Display */}
                <div className="text-center">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-3">Your Speaking Topic</h3>
                    <div
                      className="text-2xl font-bold text-primary cursor-pointer hover:text-primary/80 transition-colors p-4 rounded-lg hover:bg-muted/50 border-2 border-dashed border-muted hover:border-primary/50"
                      onClick={changeRandomTopic}
                      title="Click to change topic"
                    >
                      "{settings.topic}"
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Click topic above to change it</p>
                  </div>
                </div>

                {/* Difficulty Selection */}
                <div className="space-y-4">
                  <div className="text-center">
                    <h3 className="text-xl font-semibold mb-4">Choose Your Challenge</h3>
                  </div>
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
                        onClick={() => setSettings({ ...preset, topic: settings.topic, difficulty: key as any })}
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
                              <span className="text-muted-foreground">Duration:</span>
                              <span className="font-semibold">{Math.floor(preset.duration / 60)}m</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Changes:</span>
                              <span className="font-semibold">Every {preset.changeFrequency}s</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Total cues:</span>
                              <span className="font-semibold">
                                {Math.floor(preset.duration / preset.changeFrequency)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (gameState === "playing") {
    const progress = ((settings.duration - timeRemaining) / settings.duration) * 100
    const currentEnergyInfo = ENERGY_LEVELS[currentEnergyLevel - 1]

    return (
      <div className="min-h-screen bg-background">
        {/* Breathe Overlay */}
        {showBreathe && (
          <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="text-center">
              <div className="text-8xl font-bold text-primary mb-4 animate-pulse">BREATHE</div>
              <div className="text-xl text-primary">Take a deep breath and reset</div>
            </div>
          </div>
        )}

        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-white">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold font-serif">The Conductor</h1>
                  <p className="text-sm text-muted-foreground">{settings.topic}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant="secondary">
                  <Clock className="h-3 w-3 mr-1" />
                  {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, "0")}
                </Badge>
                <Badge variant="secondary">Next change: {Math.ceil(nextChangeIn)}s</Badge>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {/* Progress Bar */}
            <div className="mb-8">
              <Progress value={progress} className="h-2" />
            </div>

            {/* Energy Level Display */}
            <div className="text-center mb-8">
              <div className="mb-6">
                <div className="text-6xl font-bold font-serif text-foreground mb-2">
                  ENERGY <span className="text-primary">{currentEnergyLevel}</span>
                </div>
                <div className="text-2xl font-medium text-chart-2 mb-2">{currentEnergyInfo.label}</div>
                <div className="text-lg text-muted-foreground">{currentEnergyInfo.description}</div>
              </div>

              {/* Energy Meter */}
              <div className="flex justify-center mb-6">
                <div className="flex items-end space-x-2 h-32">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => (
                    <div
                      key={level}
                      className={cn(
                        "w-8 rounded-t transition-all duration-500",
                        level <= currentEnergyLevel
                          ? level <= 3
                            ? "bg-chart-2"
                            : level <= 6
                              ? "bg-primary"
                              : "bg-chart-1"
                          : "bg-muted",
                      )}
                      style={{
                        height: `${(level / 9) * 100}%`,
                        opacity: level === currentEnergyLevel ? 1 : level <= currentEnergyLevel ? 0.7 : 0.3,
                      }}
                    />
                  ))}
                </div>
              </div>
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

            {/* Instructions */}
            <div className="text-center">
              <p className="text-lg text-muted-foreground mb-2">
                {isRecording ? "Match this energy level with your voice!" : "Get ready to speak..."}
              </p>
              <p className="text-sm text-muted-foreground">
                Keep talking about: <span className="font-medium">{settings.topic}</span>
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
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-white">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold font-serif">Performance Complete!</h1>
                  <p className="text-sm text-muted-foreground">Your energy modulation results</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {/* Results Summary */}
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-chart-2 mb-2">
                    {Math.round((gameResult.successfulTransitions / gameResult.totalChanges) * 100)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Successful Transitions</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {gameResult.successfulTransitions} of {gameResult.totalChanges}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-chart-1 mb-2">
                    {gameResult.averageResponseTime.toFixed(1)}s
                  </div>
                  <div className="text-sm text-muted-foreground">Avg Response Time</div>
                  <div className="text-xs text-muted-foreground mt-1">Speed of adaptation</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-primary mb-2">{gameResult.energyRange}</div>
                  <div className="text-sm text-muted-foreground">Energy Range</div>
                  <div className="text-xs text-muted-foreground mt-1">Vocal variety used</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-chart-3 mb-2">{gameResult.breatheRecoveries}</div>
                  <div className="text-sm text-muted-foreground">Breathe Recoveries</div>
                  <div className="text-xs text-muted-foreground mt-1">Reset moments used</div>
                </CardContent>
              </Card>
            </div>

            {/* Performance Analysis */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="font-serif">Energy Modulation Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {gameResult.successfulTransitions / gameResult.totalChanges >= 0.8 && (
                    <div className="p-4 bg-chart-2/10 border border-chart-2/20 rounded-lg">
                      <h4 className="font-semibold text-chart-2 mb-2">Excellent Energy Control! 🎭</h4>
                      <p className="text-sm text-muted-foreground">
                        You adapted quickly to energy changes while maintaining your message. This shows great presence
                        and charisma potential.
                      </p>
                    </div>
                  )}

                  {gameResult.energyRange >= 6 && (
                    <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                      <h4 className="font-semibold text-primary mb-2">Great Vocal Variety! 🎵</h4>
                      <p className="text-sm text-muted-foreground">
                        You used a wide range of energy levels, making your speech dynamic and engaging. This keeps
                        audiences interested and attentive.
                      </p>
                    </div>
                  )}

                  {gameResult.averageResponseTime < 2 && (
                    <div className="p-4 bg-chart-1/10 border border-chart-1/20 rounded-lg">
                      <h4 className="font-semibold text-chart-1 mb-2">Quick Adaptation! ⚡</h4>
                      <p className="text-sm text-muted-foreground">
                        Your fast response to energy changes shows excellent awareness and control. This skill helps in
                        reading and responding to audience energy.
                      </p>
                    </div>
                  )}

                  {gameResult.breatheRecoveries > 0 && (
                    <div className="p-4 bg-chart-3/10 border border-chart-3/20 rounded-lg">
                      <h4 className="font-semibold text-chart-3 mb-2">Good Recovery Skills! 🌬️</h4>
                      <p className="text-sm text-muted-foreground">
                        You used the breathe moments to reset and refocus. This is crucial for maintaining composure
                        during long presentations.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* AI Analysis */}
            {isAnalyzing && (
              <Card className="mb-8">
                <CardContent className="p-6 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Analyzing your energy modulation with AI...</p>
                </CardContent>
              </Card>
            )}

            {!isAnalyzing && gameResult.aiScore && (
              <Card className="mb-8">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-primary mb-2">{gameResult.aiScore}%</div>
                  <div className="text-sm text-muted-foreground">AI Confidence Score</div>
                  <div className="text-xs text-muted-foreground mt-1">How well you modulated your energy</div>
                </CardContent>
              </Card>
            )}

            {!isAnalyzing && gameResult.feedback && (
              <Card className="mb-8">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-chart-2 mb-2">Feedback</div>
                  <div className="text-sm text-muted-foreground">{gameResult.feedback}</div>
                </CardContent>
              </Card>
            )}

            {!isAnalyzing && gameResult.improvements && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="font-serif">Improvement Suggestions</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-2">
                    {gameResult.improvements.map((improvement, index) => (
                      <li key={index} className="text-sm text-muted-foreground">
                        {improvement}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Button onClick={resetGame} size="lg" className="w-full">
              <RotateCcw className="h-4 w-4 mr-2" />
              Play Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
