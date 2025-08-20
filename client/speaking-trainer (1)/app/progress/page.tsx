"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, BarChart3, TrendingUp, Target, Calendar, Award, Zap, Trophy, Star, CheckCircle } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  generateMockProgressData,
  generateMockSessionHistory,
  generateAchievements,
  generatePersonalGoals,
  calculateSkillImprovement,
  type SessionRecord,
  type ProgressStats,
} from "@/lib/progress-tracking"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
} from "recharts"

export default function ProgressPage() {
  const [progressData] = useState<ProgressStats>(generateMockProgressData())
  const [sessionHistory] = useState<SessionRecord[]>(generateMockSessionHistory())
  const [achievements] = useState(generateAchievements(progressData))
  const [goals] = useState(generatePersonalGoals(progressData))

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getGameTypeLabel = (gameType: string) => {
    const labels = {
      "rapid-fire": "Rapid Fire",
      conductor: "Conductor",
      "triple-step": "Triple Step",
    }
    return labels[gameType as keyof typeof labels] || gameType
  }

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-chart-2"
    if (score >= 70) return "text-chart-1"
    if (score >= 50) return "text-primary"
    return "text-destructive"
  }

  const radarData = Object.entries(progressData.skillLevels).map(([skill, level]) => ({
    skill: skill.charAt(0).toUpperCase() + skill.slice(1),
    current: level,
    target: 90,
  }))

  const unlockedAchievements = achievements.filter((a) => a.unlockedAt)
  const lockedAchievements = achievements.filter((a) => !a.unlockedAt)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-serif">Progress Dashboard</h1>
                <p className="text-sm text-muted-foreground">Track your speaking journey</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary mb-1">{progressData.totalSessions}</div>
                <div className="text-sm text-muted-foreground">Total Sessions</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-chart-1 mb-1">{progressData.totalPracticeTime}m</div>
                <div className="text-sm text-muted-foreground">Practice Time</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className={cn("text-2xl font-bold mb-1", getScoreColor(progressData.averageScore))}>
                  {progressData.averageScore}
                </div>
                <div className="text-sm text-muted-foreground">Avg Score</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-chart-3 mb-1">{progressData.currentStreak}</div>
                <div className="text-sm text-muted-foreground">Day Streak</div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="skills">Skills</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="achievements">Achievements</TabsTrigger>
              <TabsTrigger value="goals">Goals</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Weekly Progress Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="font-serif flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-chart-1" />
                      Weekly Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={progressData.weeklyProgress}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="week" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="averageScore" stroke="hsl(var(--chart-1))" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Game Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="font-serif flex items-center gap-2">
                      <Target className="h-5 w-5 text-chart-2" />
                      Game Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={Object.entries(progressData.gamesPlayed).map(([game, count]) => ({
                          game: getGameTypeLabel(game),
                          sessions: count,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="game" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="sessions" fill="hsl(var(--chart-2))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Achievements */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif flex items-center gap-2">
                    <Award className="h-5 w-5 text-chart-3" />
                    Recent Achievements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    {unlockedAchievements.slice(0, 3).map((achievement) => (
                      <div key={achievement.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className="text-2xl">{achievement.icon}</div>
                        <div>
                          <div className="font-semibold text-sm">{achievement.title}</div>
                          <div className="text-xs text-muted-foreground">{achievement.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Skills Tab */}
            <TabsContent value="skills" className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Skills Radar Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="font-serif flex items-center gap-2">
                      <Zap className="h-5 w-5 text-primary" />
                      Skill Assessment
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="skill" />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} />
                        <Radar
                          name="Current"
                          dataKey="current"
                          stroke="hsl(var(--primary))"
                          fill="hsl(var(--primary))"
                          fillOpacity={0.3}
                        />
                        <Radar
                          name="Target"
                          dataKey="target"
                          stroke="hsl(var(--chart-2))"
                          fill="hsl(var(--chart-2))"
                          fillOpacity={0.1}
                        />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Skill Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="font-serif">Detailed Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Object.entries(progressData.skillLevels).map(([skill, level]) => {
                        const improvement = calculateSkillImprovement(sessionHistory, skill)
                        return (
                          <div key={skill} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium capitalize">{skill}</span>
                              <div className="flex items-center gap-2">
                                {improvement > 0 && (
                                  <Badge variant="secondary" className="text-xs bg-chart-2 text-white">
                                    +{improvement.toFixed(1)}
                                  </Badge>
                                )}
                                <span className={cn("text-sm font-bold", getScoreColor(level))}>{level}/100</span>
                              </div>
                            </div>
                            <Progress value={level} className="h-2" />
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-chart-1" />
                    Session History
                  </CardTitle>
                  <CardDescription>Your recent practice sessions and performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {sessionHistory.slice(0, 10).map((session) => (
                      <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col items-center">
                            <div className={cn("text-lg font-bold", getScoreColor(session.score))}>{session.score}</div>
                            <div className="text-xs text-muted-foreground">Score</div>
                          </div>
                          <div>
                            <div className="font-semibold">{getGameTypeLabel(session.gameType)}</div>
                            <div className="text-sm text-muted-foreground">{formatDate(session.timestamp)}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatDuration(session.duration)} session
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {session.achievements.map((achievement, index) => (
                            <Badge key={index} variant="secondary" className="text-xs bg-chart-3 text-white">
                              {achievement}
                            </Badge>
                          ))}
                          <Button variant="ghost" size="sm">
                            View Details
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Achievements Tab */}
            <TabsContent value="achievements" className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Unlocked Achievements */}
                <Card>
                  <CardHeader>
                    <CardTitle className="font-serif flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-chart-2" />
                      Unlocked ({unlockedAchievements.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {unlockedAchievements.map((achievement) => (
                        <div key={achievement.id} className="flex items-center gap-3 p-3 bg-chart-2/10 rounded-lg">
                          <div className="text-2xl">{achievement.icon}</div>
                          <div className="flex-1">
                            <div className="font-semibold">{achievement.title}</div>
                            <div className="text-sm text-muted-foreground">{achievement.description}</div>
                            <div className="text-xs text-chart-2 mt-1">
                              Unlocked {formatDate(achievement.unlockedAt!)}
                            </div>
                          </div>
                          <CheckCircle className="h-5 w-5 text-chart-2" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Locked Achievements */}
                <Card>
                  <CardHeader>
                    <CardTitle className="font-serif flex items-center gap-2">
                      <Star className="h-5 w-5 text-muted-foreground" />
                      In Progress ({lockedAchievements.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {lockedAchievements.map((achievement) => (
                        <div key={achievement.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                          <div className="text-2xl opacity-50">{achievement.icon}</div>
                          <div className="flex-1">
                            <div className="font-semibold text-muted-foreground">{achievement.title}</div>
                            <div className="text-sm text-muted-foreground">{achievement.description}</div>
                            <div className="mt-2">
                              <Progress value={achievement.progress} className="h-1" />
                              <div className="text-xs text-muted-foreground mt-1">
                                {achievement.progress.toFixed(0)}% complete
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Goals Tab */}
            <TabsContent value="goals" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Personal Goals
                  </CardTitle>
                  <CardDescription>Track your progress towards personal milestones</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {goals.map((goal) => (
                      <div key={goal.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="font-semibold">{goal.title}</div>
                            <div className="text-sm text-muted-foreground">{goal.description}</div>
                          </div>
                          {goal.isCompleted && <CheckCircle className="h-5 w-5 text-chart-2" />}
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span>
                              {goal.current}/{goal.target}
                            </span>
                          </div>
                          <Progress value={(goal.current / goal.target) * 100} className="h-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6">
                    <Button className="w-full">Set New Goal</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
