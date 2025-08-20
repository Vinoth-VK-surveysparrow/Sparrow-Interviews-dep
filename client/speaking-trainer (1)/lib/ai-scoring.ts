/**
 * AI-powered scoring and feedback system for speech analysis
 */

import type { AudioAnalysis } from "./audio-utils"

export interface SpeechMetrics {
  fluency: number // 0-100
  confidence: number // 0-100
  energy: number // 0-100
  clarity: number // 0-100
  pace: number // 0-100 (50 = ideal pace)
  consistency: number // 0-100
}

export interface GameSpecificMetrics {
  // Rapid Fire Analogies
  creativityScore?: number
  responseSpeed?: number
  improvisation?: number

  // The Conductor
  energyAdaptability?: number
  rangeUtilization?: number
  transitionSmoothness?: number

  // Triple Step
  integrationSkill?: number
  topicCoherence?: number
  distractionHandling?: number
}

export interface AIFeedback {
  overallScore: number
  metrics: SpeechMetrics
  gameSpecific: GameSpecificMetrics
  strengths: string[]
  improvements: string[]
  personalizedTips: string[]
  nextSteps: string[]
}

export interface GamePerformanceData {
  gameType: "rapid-fire" | "conductor" | "triple-step"
  audioBlob?: Blob
  audioAnalysis?: AudioAnalysis
  gameResults: any
  sessionData: {
    duration: number
    responses: number
    successRate: number
    averageResponseTime: number
  }
}

/**
 * Analyze speech performance using AI-powered metrics
 */
export async function analyzeSpeechPerformance(data: GamePerformanceData): Promise<AIFeedback> {
  // In a real implementation, this would send audio to an AI service
  // For now, we'll use sophisticated heuristics based on game data

  const baseMetrics = calculateBaseMetrics(data)
  const gameSpecific = calculateGameSpecificMetrics(data)
  const overallScore = calculateOverallScore(baseMetrics, gameSpecific)

  const feedback = generatePersonalizedFeedback(data, baseMetrics, gameSpecific, overallScore)

  return {
    overallScore,
    metrics: baseMetrics,
    gameSpecific,
    ...feedback,
  }
}

/**
 * Calculate base speech metrics from performance data
 */
function calculateBaseMetrics(data: GamePerformanceData): SpeechMetrics {
  const { sessionData, audioAnalysis } = data

  // Fluency based on response consistency and flow
  const fluency = Math.min(100, sessionData.successRate * 1.2 + (sessionData.responses / sessionData.duration) * 20)

  // Confidence based on response rate and speed
  const confidence = Math.min(100, sessionData.successRate * 0.8 + (sessionData.averageResponseTime < 2 ? 30 : 10))

  // Energy based on audio analysis or estimated from game performance
  const energy = audioAnalysis
    ? Math.min(100, audioAnalysis.averageVolume * 200 + audioAnalysis.energyLevels.length * 5)
    : Math.min(100, sessionData.successRate * 0.6 + 40)

  // Clarity estimated from successful responses
  const clarity = Math.min(100, sessionData.successRate * 0.9 + 20)

  // Pace based on response timing
  const idealResponseTime = data.gameType === "rapid-fire" ? 3 : data.gameType === "conductor" ? 1.5 : 4
  const paceDeviation = Math.abs(sessionData.averageResponseTime - idealResponseTime)
  const pace = Math.max(20, 100 - paceDeviation * 15)

  // Consistency based on performance stability
  const consistency = Math.min(100, sessionData.successRate * 0.8 + (sessionData.responses > 5 ? 20 : 0))

  return {
    fluency: Math.round(fluency),
    confidence: Math.round(confidence),
    energy: Math.round(energy),
    clarity: Math.round(clarity),
    pace: Math.round(pace),
    consistency: Math.round(consistency),
  }
}

/**
 * Calculate game-specific metrics
 */
function calculateGameSpecificMetrics(data: GamePerformanceData): GameSpecificMetrics {
  const { gameType, gameResults, sessionData } = data

  switch (gameType) {
    case "rapid-fire":
      return {
        creativityScore: Math.min(100, sessionData.successRate * 0.7 + Math.random() * 30),
        responseSpeed: Math.min(100, (5 - sessionData.averageResponseTime) * 25),
        improvisation: Math.min(100, sessionData.successRate * 0.8 + 20),
      }

    case "conductor":
      return {
        energyAdaptability: Math.min(100, (gameResults.successfulTransitions / gameResults.totalChanges) * 100),
        rangeUtilization: Math.min(100, gameResults.energyRange * 12),
        transitionSmoothness: Math.min(100, 100 - gameResults.averageResponseTime * 20),
      }

    case "triple-step":
      return {
        integrationSkill: Math.min(100, (gameResults.integratedWords / gameResults.totalWords) * 100),
        topicCoherence: gameResults.topicCoherence || 75,
        distractionHandling: Math.min(100, (gameResults.smoothIntegrations / gameResults.integratedWords) * 100),
      }

    default:
      return {}
  }
}

/**
 * Calculate overall performance score
 */
function calculateOverallScore(metrics: SpeechMetrics, gameSpecific: GameSpecificMetrics): number {
  const baseScore =
    (metrics.fluency + metrics.confidence + metrics.energy + metrics.clarity + metrics.pace + metrics.consistency) / 6

  const gameSpecificValues = Object.values(gameSpecific).filter((v) => v !== undefined) as number[]
  const gameScore =
    gameSpecificValues.length > 0 ? gameSpecificValues.reduce((sum, v) => sum + v, 0) / gameSpecificValues.length : 0

  return Math.round(baseScore * 0.6 + gameScore * 0.4)
}

/**
 * Generate personalized feedback based on performance
 */
function generatePersonalizedFeedback(
  data: GamePerformanceData,
  metrics: SpeechMetrics,
  gameSpecific: GameSpecificMetrics,
  overallScore: number,
): Pick<AIFeedback, "strengths" | "improvements" | "personalizedTips" | "nextSteps"> {
  const strengths: string[] = []
  const improvements: string[] = []
  const personalizedTips: string[] = []
  const nextSteps: string[] = []

  // Analyze strengths
  if (metrics.confidence >= 80) strengths.push("Strong confidence in your delivery")
  if (metrics.fluency >= 80) strengths.push("Excellent speech fluency and flow")
  if (metrics.energy >= 80) strengths.push("Great vocal energy and engagement")
  if (data.sessionData.successRate >= 0.8) strengths.push("Consistent performance under pressure")

  // Game-specific strengths
  if (data.gameType === "rapid-fire" && gameSpecific.responseSpeed! >= 80) {
    strengths.push("Lightning-fast improvisation skills")
  }
  if (data.gameType === "conductor" && gameSpecific.energyAdaptability! >= 80) {
    strengths.push("Excellent energy modulation control")
  }
  if (data.gameType === "triple-step" && gameSpecific.integrationSkill! >= 80) {
    strengths.push("Masterful integration of unexpected elements")
  }

  // Identify areas for improvement
  if (metrics.confidence < 60) improvements.push("Building confidence in spontaneous speaking")
  if (metrics.fluency < 60) improvements.push("Improving speech flow and reducing hesitations")
  if (metrics.pace < 40 || metrics.pace > 80) improvements.push("Finding your optimal speaking pace")
  if (data.sessionData.successRate < 0.6) improvements.push("Increasing response consistency")

  // Game-specific improvements
  if (data.gameType === "rapid-fire" && gameSpecific.creativityScore! < 60) {
    improvements.push("Expanding creative thinking and analogical reasoning")
  }
  if (data.gameType === "conductor" && gameSpecific.rangeUtilization! < 60) {
    improvements.push("Utilizing a wider range of vocal energy levels")
  }
  if (data.gameType === "triple-step" && gameSpecific.topicCoherence! < 70) {
    improvements.push("Maintaining topic focus while handling distractions")
  }

  // Generate personalized tips
  if (metrics.confidence < 70) {
    personalizedTips.push("Practice speaking your thoughts aloud daily to build natural confidence")
    personalizedTips.push("Remember: the goal is progress, not perfection")
  }

  if (data.sessionData.averageResponseTime > 3) {
    personalizedTips.push("Trust your first instinct - overthinking often leads to hesitation")
    personalizedTips.push("Practice the 'yes, and...' improv technique to build quick response skills")
  }

  if (metrics.energy < 60) {
    personalizedTips.push("Try physical warm-ups before speaking to increase natural energy")
    personalizedTips.push("Focus on topics you're passionate about to naturally boost enthusiasm")
  }

  // Generate next steps based on performance level
  if (overallScore >= 85) {
    nextSteps.push("Challenge yourself with advanced difficulty settings")
    nextSteps.push("Practice with real-world speaking opportunities")
    nextSteps.push("Consider mentoring others to reinforce your skills")
  } else if (overallScore >= 70) {
    nextSteps.push("Focus on your identified improvement areas")
    nextSteps.push("Try the next difficulty level when ready")
    nextSteps.push("Practice regularly to build consistency")
  } else {
    nextSteps.push("Continue practicing with current difficulty settings")
    nextSteps.push("Focus on one improvement area at a time")
    nextSteps.push("Celebrate small wins to build momentum")
  }

  return { strengths, improvements, personalizedTips, nextSteps }
}

/**
 * Generate improvement suggestions based on performance patterns
 */
export function generateImprovementPlan(recentPerformances: AIFeedback[]): {
  focusAreas: string[]
  recommendedExercises: string[]
  progressGoals: string[]
} {
  if (recentPerformances.length === 0) {
    return {
      focusAreas: ["Building foundational confidence"],
      recommendedExercises: ["Start with Rapid Fire Analogies on beginner mode"],
      progressGoals: ["Complete 5 practice sessions this week"],
    }
  }

  const avgMetrics = recentPerformances.reduce(
    (acc, feedback) => ({
      fluency: acc.fluency + feedback.metrics.fluency,
      confidence: acc.confidence + feedback.metrics.confidence,
      energy: acc.energy + feedback.metrics.energy,
      clarity: acc.clarity + feedback.metrics.clarity,
      pace: acc.pace + feedback.metrics.pace,
      consistency: acc.consistency + feedback.metrics.consistency,
    }),
    { fluency: 0, confidence: 0, energy: 0, clarity: 0, pace: 0, consistency: 0 },
  )

  const count = recentPerformances.length
  Object.keys(avgMetrics).forEach((key) => {
    avgMetrics[key as keyof typeof avgMetrics] /= count
  })

  const focusAreas: string[] = []
  const recommendedExercises: string[] = []
  const progressGoals: string[] = []

  // Identify weakest areas
  const sortedMetrics = Object.entries(avgMetrics).sort(([, a], [, b]) => a - b)
  const weakestAreas = sortedMetrics.slice(0, 2)

  weakestAreas.forEach(([metric, score]) => {
    if (score < 70) {
      switch (metric) {
        case "confidence":
          focusAreas.push("Building speaking confidence")
          recommendedExercises.push("Daily 2-minute impromptu speaking practice")
          break
        case "fluency":
          focusAreas.push("Improving speech flow")
          recommendedExercises.push("Read aloud for 10 minutes daily")
          break
        case "energy":
          focusAreas.push("Increasing vocal energy")
          recommendedExercises.push("Practice The Conductor game with high energy levels")
          break
        case "pace":
          focusAreas.push("Optimizing speaking pace")
          recommendedExercises.push("Record yourself and practice with a metronome")
          break
      }
    }
  })

  // Set progressive goals
  const avgScore = recentPerformances.reduce((sum, feedback) => sum + feedback.overallScore, 0) / count

  if (avgScore < 60) {
    progressGoals.push("Achieve 60+ average score across all games")
    progressGoals.push("Complete 10 practice sessions")
  } else if (avgScore < 80) {
    progressGoals.push("Reach 80+ average score")
    progressGoals.push("Master intermediate difficulty levels")
  } else {
    progressGoals.push("Maintain 85+ average score")
    progressGoals.push("Challenge yourself with expert-level games")
  }

  return { focusAreas, recommendedExercises, progressGoals }
}
