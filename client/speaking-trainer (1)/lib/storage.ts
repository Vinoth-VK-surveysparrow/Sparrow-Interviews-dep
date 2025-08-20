/**
 * Local storage utilities for progress tracking
 */

import type { SessionRecord, ProgressStats, Achievement, Goal } from "./progress-tracking"

const STORAGE_KEYS = {
  SESSIONS: "speakflow_sessions",
  PROGRESS: "speakflow_progress",
  ACHIEVEMENTS: "speakflow_achievements",
  GOALS: "speakflow_goals",
} as const

export function saveSession(session: SessionRecord): void {
  try {
    const existingSessions = getSessions()
    const updatedSessions = [session, ...existingSessions].slice(0, 100) // Keep last 100 sessions
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(updatedSessions))
  } catch (error) {
    console.warn("Failed to save session:", error)
  }
}

export function getSessions(): SessionRecord[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SESSIONS)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.warn("Failed to load sessions:", error)
    return []
  }
}

export function updateProgressStats(stats: Partial<ProgressStats>): void {
  try {
    const existing = getProgressStats()
    const updated = { ...existing, ...stats }
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(updated))
  } catch (error) {
    console.warn("Failed to update progress:", error)
  }
}

export function getProgressStats(): ProgressStats | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PROGRESS)
    return stored ? JSON.parse(stored) : null
  } catch (error) {
    console.warn("Failed to load progress:", error)
    return null
  }
}

export function unlockAchievement(achievementId: string): void {
  try {
    const achievements = getAchievements()
    const updated = achievements.map((achievement) =>
      achievement.id === achievementId ? { ...achievement, unlockedAt: Date.now() } : achievement,
    )
    localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(updated))
  } catch (error) {
    console.warn("Failed to unlock achievement:", error)
  }
}

export function getAchievements(): Achievement[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.warn("Failed to load achievements:", error)
    return []
  }
}

export function updateGoal(goalId: string, updates: Partial<Goal>): void {
  try {
    const goals = getGoals()
    const updated = goals.map((goal) => (goal.id === goalId ? { ...goal, ...updates } : goal))
    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(updated))
  } catch (error) {
    console.warn("Failed to update goal:", error)
  }
}

export function getGoals(): Goal[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.GOALS)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.warn("Failed to load goals:", error)
    return []
  }
}

export function clearAllData(): void {
  try {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key)
    })
  } catch (error) {
    console.warn("Failed to clear data:", error)
  }
}
