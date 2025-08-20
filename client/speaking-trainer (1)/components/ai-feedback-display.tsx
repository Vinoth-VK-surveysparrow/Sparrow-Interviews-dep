"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import type { AIFeedback } from "@/lib/ai-scoring"
import { TrendingUp, Target, Lightbulb, ArrowRight, Brain, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

interface AIFeedbackDisplayProps {
  feedback: AIFeedback
  gameType: "rapid-fire" | "conductor" | "triple-step"
  onRetry?: () => void
  onNextChallenge?: () => void
}

export function AIFeedbackDisplay({ feedback, gameType, onRetry, onNextChallenge }: AIFeedbackDisplayProps) {
  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-chart-2"
    if (score >= 70) return "text-chart-1"
    if (score >= 50) return "text-primary"
    return "text-destructive"
  }

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 85) return "default"
    if (score >= 70) return "secondary"
    return "outline"
  }

  const gameTypeLabels = {
    "rapid-fire": "Rapid Fire Analogies",
    conductor: "The Conductor",
    "triple-step": "Triple Step",
  }

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-full -translate-y-16 translate-x-16" />
        <CardHeader className="relative">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-serif flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                AI Performance Analysis
              </CardTitle>
              <p className="text-sm text-muted-foreground">{gameTypeLabels[gameType]} Session</p>
            </div>
            <div className="text-center">
              <div className={cn("text-4xl font-bold", getScoreColor(feedback.overallScore))}>
                {feedback.overallScore}
              </div>
              <Badge variant={getScoreBadgeVariant(feedback.overallScore)} className="mt-1">
                {feedback.overallScore >= 85
                  ? "Excellent"
                  : feedback.overallScore >= 70
                    ? "Good"
                    : feedback.overallScore >= 50
                      ? "Fair"
                      : "Needs Work"}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Speech Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-chart-1" />
            Speech Metrics Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(feedback.metrics).map(([metric, score]) => (
              <div key={metric} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium capitalize">{metric.replace(/([A-Z])/g, " $1").trim()}</span>
                  <span className={cn("text-sm font-bold", getScoreColor(score))}>{score}/100</span>
                </div>
                <Progress value={score} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Game-Specific Metrics */}
      {Object.keys(feedback.gameSpecific).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <Target className="h-5 w-5 text-chart-3" />
              Game-Specific Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(feedback.gameSpecific).map(([metric, score]) => {
                if (score === undefined) return null
                return (
                  <div key={metric} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium capitalize">{metric.replace(/([A-Z])/g, " $1").trim()}</span>
                      <span className={cn("text-sm font-bold", getScoreColor(score))}>{score}/100</span>
                    </div>
                    <Progress value={score} className="h-2" />
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strengths */}
      {feedback.strengths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2 text-chart-2">
              <Zap className="h-5 w-5" />
              Your Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {feedback.strengths.map((strength, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-chart-2 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-sm">{strength}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Improvements */}
      {feedback.improvements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2 text-chart-1">
              <Target className="h-5 w-5" />
              Areas for Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {feedback.improvements.map((improvement, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-chart-1 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-sm">{improvement}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Personalized Tips */}
      {feedback.personalizedTips.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2 text-primary">
              <Lightbulb className="h-5 w-5" />
              Personalized Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {feedback.personalizedTips.map((tip, index) => (
                <div key={index} className="p-3 bg-primary/5 border border-primary/10 rounded-lg">
                  <p className="text-sm">{tip}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next Steps */}
      {feedback.nextSteps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2 text-chart-3">
              <ArrowRight className="h-5 w-5" />
              Recommended Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {feedback.nextSteps.map((step, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="w-6 h-6 bg-chart-3/10 text-chart-3 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 flex-shrink-0">
                    {index + 1}
                  </div>
                  <p className="text-sm">{step}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        {onRetry && (
          <Button onClick={onRetry} variant="outline" className="flex-1 bg-transparent">
            Practice Again
          </Button>
        )}
        {onNextChallenge && (
          <Button onClick={onNextChallenge} className="flex-1">
            Next Challenge
          </Button>
        )}
      </div>
    </div>
  )
}
