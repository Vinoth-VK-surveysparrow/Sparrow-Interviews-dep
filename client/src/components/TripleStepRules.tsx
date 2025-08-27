import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Target, Clock, CheckCircle, Zap, AlertTriangle, Play, Home } from 'lucide-react';
import { useLocation } from 'wouter';

interface TripleStepRulesProps {
  onStartAssessment: () => void;
  isLoading?: boolean;
}

export default function TripleStepRules({ onStartAssessment, isLoading = false }: TripleStepRulesProps) {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex justify-start">
          <Button
            onClick={() => setLocation('/test-selection')}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Home
          </Button>
        </div>
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-lg">
              <Target className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">
                Talk on a Topic
              </h1>
              <p className="text-xl text-muted-foreground">
                Weaving Cue Cards into a Cohesive Topic
              </p>
            </div>
          </div>
        </div>
        <div className="flex justify-center mb-8">
          <Card className="shadow-lg max-w-md w-full">
            <CardContent className="p-6">
              <div className="text-sm space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-primary font-bold">1.</span>
                  <span className="font-medium">Speak continuously about your topic</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-primary font-bold">2.</span>
                  <span className="font-medium">Integrate cue cards naturally as they appear</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-primary font-bold">3.</span>
                  <span className="font-medium">Maintain topic coherence</span>
                </div>
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
