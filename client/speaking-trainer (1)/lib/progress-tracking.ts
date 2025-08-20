export interface SessionRecord {
  id: string
  gameType: "rapid-fire" | "conductor" | "triple-step"
  timestamp: number
  duration: number
  score: number
  metrics: {
    fluency: number
    confidence: number
    energy: number
    clarity: number
    pace: number
    consistency: number
  }
  gameSpecific: Record<string, number>
  improvements: string[]
  achievements: string[]
}

export interface ProgressStats {
  totalSessions: number
  totalPracticeTime: number // in minutes
  averageScore: number
  bestScore: number
  currentStreak: number
  longestStreak: number
  gamesPlayed: {
    "rapid-fire": number
    conductor: number
    "triple-step": number
  }
  skillLevels: {
    fluency: number
    confidence: number
    energy: number
    clarity: number
    pace: number
    consistency: number
  }
  weeklyProgress: Array<{
    week: string
    sessions: number
    averageScore: number
    practiceTime: number
  }>
  monthlyTrends: Array<{
    month: string
    improvement: number
    focus: string
  }>
}

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  category: "games" | "skills" | "consistency" | "improvement"
  requirement: {
    type: "sessions" | "score" | "streak" | "skill" | "game_specific"
    target: number
    gameType?: string
    metric?: string
  }
  unlockedAt?: number
  progress: number
}

export interface Goal {
  id: string
  title: string
  description: string
  target: number
  current: number
  deadline?: number
  category: "score" | "sessions" | "skill" | "consistency"
  isCompleted: boolean
  createdAt: number
}

/**
 * Mock data for demonstration - in a real app, this would come from a database
 */
export function generateMockProgressData(): ProgressStats {
  const now = Date.now()
  const oneWeek = 7 * 24 * 60 * 60 * 1000
  const oneMonth = 30 * 24 * 60 * 60 * 1000

  return {
    totalSessions: 24,
    totalPracticeTime: 180, // 3 hours
    averageScore: 76,
    bestScore: 92,
    currentStreak: 5,
    longestStreak: 8,
    gamesPlayed: {
      "rapid-fire": 12,
      conductor: 8,
      "triple-step": 4,
    },
    skillLevels: {
      fluency: 78,
      confidence: 82,
      energy: 74,
      clarity: 80,
      pace: 72,
      consistency: 76,
    },
    weeklyProgress: [
      { week: "Week 1", sessions: 3, averageScore: 65, practiceTime: 25 },
      { week: "Week 2", sessions: 5, averageScore: 71, practiceTime: 40 },
      { week: "Week 3", sessions: 6, averageScore: 78, practiceTime: 50 },
      { week: "Week 4", sessions: 7, averageScore: 82, practiceTime: 55 },
      { week: "Week 5", sessions: 3, averageScore: 85, practiceTime: 30 },
    ],
    monthlyTrends: [
      { month: "Month 1", improvement: 15, focus: "Building Confidence" },
      { month: "Month 2", improvement: 12, focus: "Energy Modulation" },
      { month: "Month 3", improvement: 8, focus: "Advanced Integration" },
    ],
  }
}

export function generateMockSessionHistory(): SessionRecord[] {
  const sessions: SessionRecord[] = []
  const gameTypes: Array<"rapid-fire" | "conductor" | "triple-step"> = ["rapid-fire", "conductor", "triple-step"]
  const now = Date.now()

  for (let i = 0; i < 10; i++) {
    const gameType = gameTypes[Math.floor(Math.random() * gameTypes.length)]
    const timestamp = now - i * 24 * 60 * 60 * 1000 - Math.random() * 12 * 60 * 60 * 1000

    sessions.push({
      id: `session-${i}`,
      gameType,
      timestamp,
      duration: Math.floor(120 + Math.random() * 300), // 2-7 minutes
      score: Math.floor(60 + Math.random() * 35), // 60-95
      metrics: {
        fluency: Math.floor(60 + Math.random() * 35),
        confidence: Math.floor(65 + Math.random() * 30),
        energy: Math.floor(55 + Math.random() * 40),
        clarity: Math.floor(70 + Math.random() * 25),
        pace: Math.floor(50 + Math.random() * 45),
        consistency: Math.floor(60 + Math.random() * 35),
      },
      gameSpecific: {
        creativityScore: gameType === "rapid-fire" ? Math.floor(60 + Math.random() * 35) : 0,
        energyAdaptability: gameType === "conductor" ? Math.floor(65 + Math.random() * 30) : 0,
        integrationSkill: gameType === "triple-step" ? Math.floor(55 + Math.random() * 40) : 0,
      },
      improvements: ["Faster response time", "Better energy control"],
      achievements: i === 0 ? ["First Perfect Score!"] : i === 5 ? ["5-Day Streak"] : [],
    })
  }

  return sessions.sort((a, b) => b.timestamp - a.timestamp)
}

export function generateAchievements(stats: ProgressStats): Achievement[] {
  const achievements: Achievement[] = [
    {
      id: "first-session",
      title: "Getting Started",
      description: "Complete your first practice session",
      icon: "🎯",
      category: "games",
      requirement: { type: "sessions", target: 1 },
      progress: Math.min(100, (stats.totalSessions / 1) * 100),
      unlockedAt: stats.totalSessions >= 1 ? Date.now() - 1000000 : undefined,
    },
    {
      id: "dedicated-learner",
      title: "Dedicated Learner",
      description: "Complete 10 practice sessions",
      icon: "📚",
      category: "games",
      requirement: { type: "sessions", target: 10 },
      progress: Math.min(100, (stats.totalSessions / 10) * 100),
      unlockedAt: stats.totalSessions >= 10 ? Date.now() - 500000 : undefined,
    },
    {
      id: "high-achiever",
      title: "High Achiever",
      description: "Score 90+ in any game",
      icon: "🏆",
      category: "skills",
      requirement: { type: "score", target: 90 },
      progress: Math.min(100, (stats.bestScore / 90) * 100),
      unlockedAt: stats.bestScore >= 90 ? Date.now() - 300000 : undefined,
    },
    {
      id: "consistent-performer",
      title: "Consistent Performer",
      description: "Maintain a 5-day practice streak",
      icon: "🔥",
      category: "consistency",
      requirement: { type: "streak", target: 5 },
      progress: Math.min(100, (stats.currentStreak / 5) * 100),
      unlockedAt: stats.currentStreak >= 5 ? Date.now() - 100000 : undefined,
    },
    {
      id: "confidence-builder",
      title: "Confidence Builder",
      description: "Reach 80+ confidence level",
      icon: "💪",
      category: "skills",
      requirement: { type: "skill", target: 80, metric: "confidence" },
      progress: Math.min(100, (stats.skillLevels.confidence / 80) * 100),
      unlockedAt: stats.skillLevels.confidence >= 80 ? Date.now() - 200000 : undefined,
    },
    {
      id: "energy-master",
      title: "Energy Master",
      description: "Master energy modulation in The Conductor",
      icon: "⚡",
      category: "games",
      requirement: { type: "game_specific", target: 85, gameType: "conductor" },
      progress: Math.min(100, (stats.gamesPlayed.conductor / 5) * 100),
      unlockedAt: stats.gamesPlayed.conductor >= 5 ? Date.now() - 150000 : undefined,
    },
  ]

  return achievements
}

export function generatePersonalGoals(stats: ProgressStats): Goal[] {
  return [
    {
      id: "weekly-sessions",
      title: "Weekly Practice Goal",
      description: "Complete 5 practice sessions this week",
      target: 5,
      current: 3,
      category: "sessions",
      isCompleted: false,
      createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    },
    {
      id: "improve-fluency",
      title: "Improve Fluency",
      description: "Reach 85+ fluency score",
      target: 85,
      current: stats.skillLevels.fluency,
      category: "skill",
      isCompleted: stats.skillLevels.fluency >= 85,
      createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    },
    {
      id: "master-triple-step",
      title: "Master Triple Step",
      description: "Complete 10 Triple Step sessions",
      target: 10,
      current: stats.gamesPlayed["triple-step"],
      category: "sessions",
      isCompleted: stats.gamesPlayed["triple-step"] >= 10,
      createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    },
  ]
}

export function calculateSkillImprovement(sessions: SessionRecord[], skill: string): number {
  if (sessions.length < 2) return 0

  const recentSessions = sessions.slice(0, 5)
  const olderSessions = sessions.slice(-5)

  const recentAvg =
    recentSessions.reduce((sum, session) => sum + (session.metrics[skill as keyof typeof session.metrics] || 0), 0) /
    recentSessions.length

  const olderAvg =
    olderSessions.reduce((sum, session) => sum + (session.metrics[skill as keyof typeof session.metrics] || 0), 0) /
    olderSessions.length

  return recentAvg - olderAvg
}
