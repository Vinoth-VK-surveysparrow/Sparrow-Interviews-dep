"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, Target, Clock, CheckCircle, XCircle, RotateCcw, Play, Zap } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

interface GameSettings {
  mainTopic: string
  wordTypes: string[]
  totalWords: number
  dropFrequency: number
  integrationTime: number
  difficulty: "beginner" | "intermediate" | "advanced" | "expert"
}

interface WordDrop {
  word: string
  timestamp: number
  integrated: boolean
  integrationTime?: number
  timeRemaining: number
}

interface GameResult {
  totalWords: number
  integratedWords: number
  averageIntegrationTime: number
  topicCoherence: number
  missedWords: string[]
  smoothIntegrations: number
  aiScore?: {
    confidence_score: number
    specific_feedback: string
    next_steps?: string[]
    integration_rate?: number
    average_integration_time?: number
    missed_words?: string[]
  }
}

type GameState = "setup" | "playing" | "feedback"

const MAIN_TOPICS = [
  "Innovation in technology",
  "The future of work",
  "Building meaningful relationships",
  "Overcoming personal challenges",
  "The power of creativity",
  "Leadership in modern times",
  "Sustainable living",
  "The importance of education",
  "Digital transformation",
  "Mental health awareness",
  "Entrepreneurship journey",
  "Climate change solutions",
  "Artificial intelligence impact",
  "Social media influence",
  "Work-life balance",
]

const WORD_CATEGORIES = {
  objects: [
    "pumpkin",
    "microwave",
    "telescope",
    "bicycle",
    "umbrella",
    "keyboard",
    "sandwich",
    "camera",
    "pillow",
    "guitar",
  ],
  emotions: [
    "nostalgia",
    "excitement",
    "curiosity",
    "frustration",
    "serenity",
    "anxiety",
    "joy",
    "melancholy",
    "confidence",
    "wonder",
  ],
  places: ["library", "mountain", "cafe", "beach", "forest", "city", "garden", "desert", "bridge", "marketplace"],
  actions: [
    "dancing",
    "cooking",
    "traveling",
    "reading",
    "exercising",
    "painting",
    "singing",
    "writing",
    "exploring",
    "building",
  ],
  abstract: [
    "freedom",
    "justice",
    "beauty",
    "wisdom",
    "courage",
    "harmony",
    "progress",
    "tradition",
    "innovation",
    "balance",
  ],
  nature: ["ocean", "sunrise", "storm", "flower", "river", "tree", "wind", "rain", "snow", "lightning"],
}

const DIFFICULTY_PRESETS: Record<string, Omit<GameSettings, "mainTopic" | "wordTypes">> = {
  beginner: { totalWords: 4, dropFrequency: 40, integrationTime: 8, difficulty: "beginner" },
  intermediate: { totalWords: 6, dropFrequency: 30, integrationTime: 6, difficulty: "intermediate" },
  advanced: { totalWords: 8, dropFrequency: 20, integrationTime: 5, difficulty: "advanced" },
  expert: { totalWords: 10, dropFrequency: 15, integrationTime: 4, difficulty: "expert" },
}

export default function TripleStepPage() {
  const [gameState, setGameState] = useState<GameState>("setup")
  const [settings, setSettings] = useState<GameSettings>({
    ...DIFFICULTY_PRESETS.beginner,
    mainTopic: "",
    wordTypes: ["objects", "emotions"], // Default word types
  })
  const [activeWords, setActiveWords] = useState<WordDrop[]>([])
  const [completedWords, setCompletedWords] = useState<WordDrop[]>([])
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [nextWordCountdown, setNextWordCountdown] = useState(0)
  const [gameResult, setGameResult] = useState<GameResult | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [audioChunkCount, setAudioChunkCount] = useState(0)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [wordsDropped, setWordsDropped] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const recordingStartTimeRef = useRef<number>(0)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const wordDropIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null)
  const wordIntegrationTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const router = useRouter()

  const gameDataRef = useRef<{
    activeWords: WordDrop[]
    completedWords: WordDrop[]
    mainTopic: string
  }>({
    activeWords: [],
    completedWords: [],
    mainTopic: "",
  })

  // Generate random topic
  const getRandomTopic = () => {
    return MAIN_TOPICS[Math.floor(Math.random() * MAIN_TOPICS.length)]
  }

  // Generate random word from selected categories
  const getRandomWord = () => {
    const availableWords: string[] = []

    settings.wordTypes.forEach((category) => {
      const categoryWords = WORD_CATEGORIES[category as keyof typeof WORD_CATEGORIES] || []
      availableWords.push(...categoryWords)
    })

    const randomWord = availableWords[Math.floor(Math.random() * availableWords.length)]
    return randomWord
  }

  // Start the game
  const startGame = () => {
    const topic = settings.mainTopic || getRandomTopic()
    setSettings((prev) => ({ ...prev, mainTopic: topic }))
    setGameState("playing")
    setTimeRemaining(settings.totalWords * settings.dropFrequency + 60)
    setActiveWords([])
    setCompletedWords([])
    setWordsDropped(0)
    setAudioChunkCount(0)
    setRecordingDuration(0)
    setAudioLevel(0)
    setNextWordCountdown(settings.dropFrequency)

    // Start recording immediately
    startRecording()
    startGameFlow()
  }

  const startGameFlow = () => {
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

    startWordDropSystem()
  }

  const startWordDropSystem = () => {
    // Drop first word immediately
    setTimeout(() => {
      dropNextWord()
      setNextWordCountdown(settings.dropFrequency)

      // Start countdown timer
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = setInterval(() => {
        setNextWordCountdown((prev) => {
          if (prev <= 1) {
            return settings.dropFrequency // Reset for next word
          }
          return prev - 1
        })
      }, 1000)

      // Start word dropping interval
      if (wordDropIntervalRef.current) clearInterval(wordDropIntervalRef.current)
      wordDropIntervalRef.current = setInterval(() => {
        dropNextWord()
      }, settings.dropFrequency * 1000)
    }, 1000) // Small delay to ensure game is fully started
  }

  const dropNextWord = () => {
    setWordsDropped((currentCount) => {
      if (currentCount >= settings.totalWords) {
        // Stop dropping words
        if (wordDropIntervalRef.current) {
          clearInterval(wordDropIntervalRef.current)
          wordDropIntervalRef.current = null
        }
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current)
          countdownTimerRef.current = null
        }
        setNextWordCountdown(0)
        console.log(`[v0] TRIPLE-STEP: All ${settings.totalWords} words have been dropped`)
        return currentCount
      }

      const newWord = getRandomWord()
      const wordDrop: WordDrop = {
        word: newWord,
        timestamp: Date.now(),
        integrated: false,
        timeRemaining: settings.integrationTime,
      }

      setActiveWords((prev) => [...prev, wordDrop])
      const newCount = currentCount + 1
      console.log(`[v0] TRIPLE-STEP: Dropped word "${newWord}" - ${newCount}/${settings.totalWords}`)

      startWordIntegrationTimer(wordDrop)

      return newCount
    })
  }

  const startWordIntegrationTimer = (wordDrop: WordDrop) => {
    const timer = setInterval(() => {
      setActiveWords((prev) =>
        prev.map((word) => {
          if (word.word === wordDrop.word && word.timestamp === wordDrop.timestamp) {
            const newTimeRemaining = word.timeRemaining - 1
            if (newTimeRemaining <= 0) {
              setTimeout(() => {
                setActiveWords((current) =>
                  current.filter((w) => !(w.word === word.word && w.timestamp === wordDrop.timestamp)),
                )
                setCompletedWords((current) => [...current, { ...word, integrated: false, timeRemaining: 0 }])
                console.log(`[v0] TRIPLE-STEP: Word "${word.word}" expired (not integrated)`)
              }, 0)
              return { ...word, timeRemaining: 0 }
            }
            return { ...word, timeRemaining: newTimeRemaining }
          }
          return word
        }),
      )
    }, 1000)

    wordIntegrationTimersRef.current.set(`${wordDrop.word}-${wordDrop.timestamp}`, timer)

    // Clear timer after integration time
    setTimeout(
      () => {
        clearInterval(timer)
        wordIntegrationTimersRef.current.delete(`${wordDrop.word}-${wordDrop.timestamp}`)
      },
      settings.integrationTime * 1000 + 100,
    )
  }

  // End the game and calculate results
  const endGame = async () => {
    console.log("[v0] TRIPLE-STEP: endGame function called")

    // Capture current word data for API
    const allWords = [...completedWords, ...activeWords]
    const wordData = {
      activeWords: activeWords.length,
      completedWords: completedWords.length,
      totalWords: allWords.length,
    }
    console.log("[v0] TRIPLE-STEP: Captured word data:", JSON.stringify(wordData))

    // Stop recording and timers
    stopRecording()
    clearAllTimers()

    setGameResult({
      totalWords: settings.totalWords,
      integratedWords: 0, // Will be updated by Gemini analysis
      averageIntegrationTime: 0, // Will be updated by Gemini analysis
      topicCoherence: 0, // Will be updated by Gemini analysis
      missedWords: [], // Will be updated by Gemini analysis
      smoothIntegrations: 0,
    })

    setGameState("feedback")
  }

  const clearAllTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    if (wordDropIntervalRef.current) clearTimeout(wordDropIntervalRef.current)
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
    wordIntegrationTimersRef.current.forEach((timer) => clearInterval(timer))
    wordIntegrationTimersRef.current.clear()
  }

  const startRecording = async () => {
    try {
      console.log("[v0] TRIPLE-STEP: Starting MediaRecorder")
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)
      analyser.fftSize = 256
      audioContextRef.current = audioContext
      analyserRef.current = analyser

      let mimeType = "audio/webm"
      let fileExtension = "webm"
      let mediaRecorderOptions = { mimeType }

      if (MediaRecorder.isTypeSupported("audio/ogg")) {
        mimeType = "audio/ogg"
        fileExtension = "ogg"
        mediaRecorderOptions = { mimeType, audioBitsPerSecond: 32000 } // Reduced from default ~128kbps
        console.log("[v0] TRIPLE-STEP: Using audio/ogg format with 32kbps bitrate for Gemini compatibility")
      } else if (MediaRecorder.isTypeSupported("audio/ogg; codecs=opus")) {
        mimeType = "audio/ogg; codecs=opus"
        fileExtension = "ogg"
        mediaRecorderOptions = { mimeType, audioBitsPerSecond: 32000 }
        console.log("[v0] TRIPLE-STEP: Using audio/ogg with opus codec at 32kbps for Gemini compatibility")
      } else if (MediaRecorder.isTypeSupported("audio/mpeg")) {
        mimeType = "audio/mpeg"
        fileExtension = "mp3"
        mediaRecorderOptions = { mimeType, audioBitsPerSecond: 32000 }
        console.log("[v0] TRIPLE-STEP: Using audio/mpeg (mp3) format at 32kbps for Gemini compatibility")
      } else {
        mediaRecorderOptions = { mimeType, audioBitsPerSecond: 32000 }
        console.log("[v0] TRIPLE-STEP: No Gemini-supported formats available, using fallback audio/webm at 32kbps")
      }

      const mediaRecorder = new MediaRecorder(stream, mediaRecorderOptions)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      setAudioChunkCount(0)
      setRecordingDuration(0)
      recordingStartTimeRef.current = Date.now()

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
          setAudioChunkCount(audioChunksRef.current.length)
          console.log(
            "[v0] TRIPLE-STEP: Audio chunk received, size:",
            event.data.size,
            "total chunks:",
            audioChunksRef.current.length,
          )
        }
      }

      mediaRecorder.onstop = () => {
        console.log("[v0] TRIPLE-STEP: MediaRecorder stopped, total chunks:", audioChunksRef.current.length)
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        console.log("[v0] TRIPLE-STEP: Created audio blob, size:", audioBlob.size, "type:", mimeType)

        const maxSizeBytes = 20 * 1024 * 1024 // 20MB
        if (audioBlob.size > maxSizeBytes) {
          console.error("[v0] TRIPLE-STEP: Audio file too large for Gemini:", audioBlob.size, "bytes")
          setIsAnalyzing(false)
          setGameResult({
            ...gameResult,
            aiScore: {
              confidence_score: "N/A",
              specific_feedback: "Recording was too long for analysis. Please try a shorter session.",
              next_steps: ["Keep sessions under 3-4 minutes for optimal analysis"],
            },
          })
          return
        }

        if (audioContextRef.current) {
          audioContextRef.current.close()
          audioContextRef.current = null
        }
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current)
          recordingTimerRef.current = null
        }

        if (audioBlob.size > 0) {
          console.log("[v0] TRIPLE-STEP: Audio successfully saved, sending for analysis")
          analyzeWithAI(audioBlob)
        } else {
          console.error("[v0] TRIPLE-STEP: Audio blob is empty")
          setIsAnalyzing(false)
        }
      }

      mediaRecorder.start(1000)
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

      console.log("[v0] TRIPLE-STEP: MediaRecorder started successfully with format:", mimeType)
    } catch (error) {
      console.error("[v0] TRIPLE-STEP: Failed to start recording:", error)
    }
  }

  const stopRecording = () => {
    console.log("[v0] TRIPLE-STEP: stopRecording called")
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      console.log("[v0] TRIPLE-STEP: Stopping MediaRecorder")
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

  const analyzeWithAI = async (audioBlob: Blob) => {
    console.log("[v0] TRIPLE-STEP: Starting AI analysis with audio blob size:", audioBlob.size, "type:", audioBlob.type)

    const allWords = [...completedWords, ...activeWords]

    const simplifiedWordData = {
      totalWords: settings.totalWords,
      completedWords: completedWords.length,
      activeWords: activeWords.length,
    }
    console.log("[v0] TRIPLE-STEP: Sending word data to API:", JSON.stringify(simplifiedWordData))

    const formData = new FormData()
    formData.append("audio", audioBlob)
    formData.append(
      "gameData",
      JSON.stringify({
        gameType: "triple-step",
        mainTopic: settings.mainTopic,
        wordDrops: allWords.map((word) => ({ word: word.word })),
        totalWords: settings.totalWords,
        integrationTime: settings.integrationTime,
      }),
    )

    try {
      console.log("[v0] TRIPLE-STEP: Sending request to /api/analyze-speech")
      const response = await fetch("/api/analyze-speech", {
        method: "POST",
        body: formData,
      })

      console.log("[v0] TRIPLE-STEP: Response status:", response.status)

      if (response.ok) {
        const result = await response.json()
        console.log("[v0] TRIPLE-STEP: Analysis result:", JSON.stringify(result).substring(0, 200) + "...")

        setGameResult((prev) => ({
          ...prev,
          aiScore: result,
          // Extract metrics from Gemini's analysis if available
          integratedWords: result.integration_rate
            ? Math.round((result.integration_rate / 100) * settings.totalWords)
            : prev.integratedWords,
          averageIntegrationTime: result.average_integration_time || prev.averageIntegrationTime,
          missedWords: result.missed_words || prev.missedWords,
        }))

        console.log("[v0] TRIPLE-STEP: Game result updated with AI analysis")
      } else {
        console.error("[v0] TRIPLE-STEP: Analysis failed with status:", response.status)
        const errorText = await response.text()
        console.error("[v0] TRIPLE-STEP: Error response:", errorText)
      }
    } catch (error) {
      console.error("[v0] TRIPLE-STEP: Analysis error:", error)
    } finally {
      setIsAnalyzing(false)
      console.log("[v0] TRIPLE-STEP: Analysis complete")
    }
  }

  const resetGame = () => {
    setGameState("setup")
    setActiveWords([])
    setCompletedWords([])
    setTimeRemaining(0)
    setNextWordCountdown(0)
    setGameResult(null)
    setWordsDropped(0)
    setAudioChunkCount(0)
    setRecordingDuration(0)
    setAudioLevel(0)

    // Clear all timers
    clearAllTimers()

    // Stop recording if active
    if (isRecording) {
      stopRecording()
    }
  }

  useEffect(() => {
    gameDataRef.current = {
      activeWords,
      completedWords,
      mainTopic: settings.mainTopic,
    }
  }, [activeWords, completedWords, settings.mainTopic])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllTimers()
    }
  }, [])

  useEffect(() => {
    if (!settings.mainTopic) {
      setSettings((prev) => ({ ...prev, mainTopic: getRandomTopic() }))
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
                  <Target className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold font-serif bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Triple Step
                  </h1>
                  <p className="text-muted-foreground">Master integration under pressure</p>
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
                  disabled={settings.wordTypes.length === 0}
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
                    <h3 className="text-lg font-semibold mb-3">Your Main Speaking Topic</h3>
                    <div
                      className="text-2xl font-bold text-primary cursor-pointer hover:text-primary/80 transition-colors p-4 rounded-lg hover:bg-muted/50 border-2 border-dashed border-muted hover:border-primary/50"
                      onClick={() => setSettings((prev) => ({ ...prev, mainTopic: getRandomTopic() }))}
                      title="Click to change topic"
                    >
                      "{settings.mainTopic}"
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Click topic above to change it</p>
                  </div>
                </div>

                {/* Difficulty Selection */}
                <div className="space-y-4">
                  <div className="text-center">
                    <h3 className="text-xl font-semibold mb-4">Choose Your Challenge</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(DIFFICULTY_PRESETS).map(([key, preset]) => (
                      <Card
                        key={key}
                        className={cn(
                          "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 border-2",
                          settings.difficulty === key
                            ? "ring-2 ring-primary bg-gradient-to-br from-primary/10 to-accent/10 border-primary shadow-lg"
                            : "border-border hover:border-primary/50",
                        )}
                        onClick={() => setSettings((prev) => ({ ...prev, ...preset, difficulty: key as any }))}
                      >
                        <CardContent className="p-4 text-center">
                          <div className="mb-3">
                            <div
                              className={cn(
                                "w-10 h-10 mx-auto rounded-full flex items-center justify-center text-white font-bold text-sm",
                                key === "beginner" && "bg-gradient-to-br from-accent to-accent/80",
                                key === "intermediate" && "bg-gradient-to-br from-primary to-primary/80",
                                key === "advanced" && "bg-gradient-to-br from-chart-1 to-chart-1/80",
                                key === "expert" && "bg-gradient-to-br from-chart-2 to-chart-2/80",
                              )}
                            >
                              {key === "beginner" && "B"}
                              {key === "intermediate" && "I"}
                              {key === "advanced" && "A"}
                              {key === "expert" && "E"}
                            </div>
                          </div>
                          <h4 className="font-semibold capitalize mb-2 text-sm">{key}</h4>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div>{preset.totalWords} words</div>
                            <div>{preset.integrationTime}s to integrate</div>
                            <div>Every {preset.dropFrequency}s</div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <details className="group">
                  <summary className="cursor-pointer text-center p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                    <span className="font-semibold text-primary">Advanced Settings</span>
                    <span className="ml-2 text-muted-foreground group-open:rotate-180 transition-transform inline-block">
                      ▼
                    </span>
                  </summary>

                  <div className="mt-6 space-y-6">
                    {/* Word Type Selection */}
                    <div className="space-y-4">
                      <h3 className="font-semibold">Random Word Types</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {Object.keys(WORD_CATEGORIES).map((category) => (
                          <label key={category} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.wordTypes.includes(category)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSettings((prev) => ({ ...prev, wordTypes: [...prev.wordTypes, category] }))
                                } else {
                                  setSettings((prev) => ({
                                    ...prev,
                                    wordTypes: prev.wordTypes.filter((t) => t !== category),
                                  }))
                                }
                              }}
                              className="rounded border-border"
                            />
                            <span className="text-sm capitalize">{category}</span>
                          </label>
                        ))}
                      </div>
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
    const progress = (wordsDropped / settings.totalWords) * 100

    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-chart-3/10 text-chart-3">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold font-serif">{settings.mainTopic}</h1>
                  <p className="text-sm text-muted-foreground">Triple Step</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                
                
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {/* Progress Bar */}
            <div className="mb-8">
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between text-sm text-muted-foreground mt-2">
                <span>
                  Words dropped: {wordsDropped}/{settings.totalWords}
                </span>
                
              </div>
            </div>

            {/* Game Status */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-white">
                  {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, "0")}
                </div>
                <div className="text-sm text-white/80">Time Remaining</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-white">
                  {nextWordCountdown > 0 ? nextWordCountdown : wordsDropped >= settings.totalWords ? "Complete" : "0"}
                </div>
                <div className="text-sm text-white/80">
                  {wordsDropped >= settings.totalWords ? "All Words Dropped" : "Next Word In"}
                </div>
              </div>
            </div>

            {activeWords.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-3">Active Words</h3>
                <div className="space-y-2">
                  {activeWords.map((wordDrop, index) => (
                    <div
                      key={`${wordDrop.word}-${wordDrop.timestamp}`}
                      className="bg-primary border border-accent rounded-lg p-3 shadow-lg"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-white">{wordDrop.word}</span>
                        <div className="text-sm text-white/90 font-semibold">{wordDrop.timeRemaining}s remaining</div>
                      </div>
                      <div className="text-xs text-white/80 mt-1">Integrate this word into your speech naturally</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {completedWords.length > 0 && (
              <div className="mb-8">
                <h3 className="font-semibold mb-4">Word Integration History</h3>
                <div className="flex flex-wrap gap-2">
                  {completedWords.map((wordDrop, index) => (
                    <Badge
                      key={index}
                      variant={wordDrop.integrated ? "default" : "destructive"}
                      className={cn(
                        "flex items-center gap-1",
                        wordDrop.integrated ? "bg-accent text-white" : "bg-destructive text-destructive-foreground",
                      )}
                    >
                      {wordDrop.integrated ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {wordDrop.word}
                      {wordDrop.integrated && wordDrop.integrationTime && (
                        <span className="text-xs opacity-75">({wordDrop.integrationTime.toFixed(1)}s)</span>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Recording Status */}
            <div className="flex justify-center mb-8">
              <div className="flex items-center gap-4 p-4 bg-card border rounded-lg">
                {isRecording ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
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
                      
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-muted-foreground">Not recording</span>
                  </>
                )}
              </div>
            </div>

            {/* Instructions */}
            <div className="text-center">
              <p className="text-lg text-muted-foreground mb-2">
                {activeWords.length > 0
                  ? `Weave these words into your speech about ${settings.mainTopic}!`
                  : `Keep speaking about: ${settings.mainTopic}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {isRecording
                  ? "Stay focused on your main message while integrating distractions"
                  : "Get ready to speak..."}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (gameState === "feedback") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="text-gray-600">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Home
            </Button>
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
              <Zap className="w-4 h-4 text-purple-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Game Complete!</h1>
            <p className="text-gray-600">Here's your integration mastery</p>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {gameResult?.aiScore?.integration_rate
                  ? `${gameResult.aiScore.integration_rate}%`
                  : gameResult?.integratedWords
                    ? `${Math.round((gameResult.integratedWords / gameResult.totalWords) * 100)}%`
                    : "0%"}
              </div>
              <div className="text-gray-700 font-medium mb-1">Integration Rate</div>
              <div className="text-sm text-gray-500">{gameResult?.aiScore ? "AI-analyzed" : "Pending analysis"}</div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="text-3xl font-bold text-orange-600 mb-2">
                {gameResult?.aiScore?.average_integration_time
                  ? `${gameResult.aiScore.average_integration_time}s`
                  : gameResult?.averageIntegrationTime
                    ? `${gameResult.averageIntegrationTime.toFixed(1)}s`
                    : "0.0s"}
              </div>
              <div className="text-gray-700 font-medium mb-1">Avg Integration Time</div>
              <div className="text-sm text-gray-500">{gameResult?.aiScore ? "AI-analyzed" : "Pending analysis"}</div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="text-3xl font-bold text-red-600 mb-2">
                {gameResult?.aiScore?.missed_words
                  ? gameResult.aiScore.missed_words.length
                  : gameResult?.missedWords
                    ? gameResult.missedWords.length
                    : 0}
              </div>
              <div className="text-gray-700 font-medium mb-1">Missed Words</div>
              <div className="text-sm text-gray-500">{gameResult?.aiScore ? "AI-analyzed" : "Pending analysis"}</div>
            </div>
          </div>

          {/* AI Analysis Loading or Results */}
          {isAnalyzing ? (
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 mb-8">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mr-3"></div>
                <span className="text-gray-600">Analyzing your performance with AI...</span>
              </div>
            </div>
          ) : (
            gameResult?.aiScore && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Integration Mastery Analysis</h2>

                <div className="space-y-4">
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <h3 className="font-semibold text-orange-800 mb-2">
                      Confidence Score: {gameResult.aiScore.confidence_score}/100
                    </h3>
                    <p className="text-orange-700">{gameResult.aiScore.specific_feedback}</p>
                  </div>

                  {gameResult.aiScore.next_steps && gameResult.aiScore.next_steps.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h3 className="font-semibold text-blue-800 mb-2">Next Steps</h3>
                      <ul className="list-disc list-inside text-blue-700 space-y-1">
                        {gameResult.aiScore.next_steps.map((step, index) => (
                          <li key={index}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={resetGame} size="lg" className="px-8">
              <RotateCcw className="h-4 w-4 mr-2" />
              Master More Words
            </Button>
            <Link href="/games/rapid-fire">
              <Button variant="outline" size="lg" className="px-8 bg-transparent">
                Try Other Games
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
    )
  }

  return null
}
