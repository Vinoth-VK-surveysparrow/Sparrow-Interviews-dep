import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Target, Clock, CheckCircle, Zap, AlertTriangle, Play } from 'lucide-react';

interface TripleStepRulesProps {
  onStartAssessment: () => void;
  isLoading?: boolean;
}

export default function TripleStepRules({ onStartAssessment, isLoading = false }: TripleStepRulesProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-lg">
              <Target className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">
                Triple Step Assessment
              </h1>
              <p className="text-xl text-muted-foreground">
                Master integration under pressure
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-8 mb-12">
          {/* How It Works */}
          <Card className="shadow-xl border-0 bg-card/90 backdrop-blur-sm">
            <CardContent className="p-8">
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                <Target className="h-6 w-6 text-primary" />
                How It Works
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="text-primary font-bold text-lg">1.</span>
                    <div>
                      <h3 className="font-semibold mb-1">Continuous Speaking</h3>
                      <p className="text-muted-foreground">Speak about your assigned topic continuously throughout the assessment</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-primary font-bold text-lg">2.</span>
                    <div>
                      <h3 className="font-semibold mb-1">Word Integration</h3>
                      <p className="text-muted-foreground">Random words will appear on screen every few seconds</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-primary font-bold text-lg">3.</span>
                    <div>
                      <h3 className="font-semibold mb-1">Natural Flow</h3>
                      <p className="text-muted-foreground">Integrate these words naturally into your speech without breaking flow</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="text-primary font-bold text-lg">4.</span>
                    <div>
                      <h3 className="font-semibold mb-1">Time Pressure</h3>
                      <p className="text-muted-foreground">Each word has a time limit to be integrated before it disappears</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-primary font-bold text-lg">5.</span>
                    <div>
                      <h3 className="font-semibold mb-1">Topic Coherence</h3>
                      <p className="text-muted-foreground">Maintain topic coherence while handling multiple distractions</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-primary font-bold text-lg">6.</span>
                    <div>
                      <h3 className="font-semibold mb-1">AI Analysis</h3>
                      <p className="text-muted-foreground">Your performance will be analyzed for integration rate and speaking clarity</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assessment Details */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="shadow-lg">
              <CardContent className="p-6 text-center">
                <Clock className="h-8 w-8 text-blue-500 dark:text-blue-400 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Duration</h3>
                <p className="text-muted-foreground text-sm">
                  Assessment duration varies based on number of words to integrate
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardContent className="p-6 text-center">
                <Zap className="h-8 w-8 text-orange-500 dark:text-orange-400 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Difficulty</h3>
                <p className="text-muted-foreground text-sm">
                  Words appear at regular intervals with limited integration time
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardContent className="p-6 text-center">
                <CheckCircle className="h-8 w-8 text-green-500 dark:text-green-400 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Scoring</h3>
                <p className="text-muted-foreground text-sm">
                  Based on integration rate, speaking clarity, and topic coherence
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tips for Success */}
          <Card className="shadow-xl border-0 bg-card/90 backdrop-blur-sm">
            <CardContent className="p-8">
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-orange-500" />
                Tips for Success
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <p className="text-muted-foreground">Start speaking immediately and maintain continuous flow</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <p className="text-muted-foreground">Stay focused on your main topic while integrating words</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <p className="text-muted-foreground">Use natural transitions to weave in new words</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <p className="text-muted-foreground">Keep an eye on word timers and prioritize accordingly</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <p className="text-muted-foreground">Practice creative word integration before starting</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <p className="text-muted-foreground">Speak clearly for better speech recognition accuracy</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Technical Requirements */}
          <Card className="shadow-lg border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-800">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-orange-600 dark:text-orange-400">
                <AlertTriangle className="h-5 w-5" />
                Before You Begin
              </h3>
              <div className="space-y-2 text-sm text-orange-600 dark:text-orange-400">
                <p>• Ensure your microphone is working and permissions are granted</p>
                <p>• Use a quiet environment for best speech recognition</p>
                <p>• Chrome or Safari browsers recommended for optimal performance</p>
                <p>• The assessment will record audio and video for analysis</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Start Button */}
        <div className="text-center">
          <Button 
            onClick={onStartAssessment}
            size="lg"
            className="bg-primary hover:bg-primary/90 px-12 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                Loading Assessment...
              </>
            ) : (
              <>
                <Play className="h-6 w-6 mr-3" />
                Start Triple Step Assessment
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
