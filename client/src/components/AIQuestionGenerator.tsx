import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AIQuestionGeneratorProps {
  assessmentType: 'QA' | 'rapid-fire' | 'conductor' | 'triple-step' | 'games-arena';
  numQuestions: number;
  numWords?: number;
  onQuestionsGenerated: (data: any) => void;
  canGenerate: boolean;
}

export default function AIQuestionGenerator({
  assessmentType,
  numQuestions,
  numWords,
  onQuestionsGenerated,
  canGenerate
}: AIQuestionGeneratorProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedData, setGeneratedData] = useState<any>(null);
  const { toast } = useToast();

  const getApiUrl = () => {
    const baseUrl = import.meta.env.VITE_CREATE_TEST_URL;
    switch (assessmentType) {
      case 'QA':
        return `${baseUrl}/qa`;
      case 'rapid-fire':
        return `${baseUrl}/rapid-fire`;
      case 'conductor':
        return `${baseUrl}/conductor`;
      case 'triple-step':
        return `${baseUrl}/triple-step`;
      default:
        return '';
    }
  };

  const getPlaceholder = () => {
    switch (assessmentType) {
      case 'QA':
        return 'Describe the type of QA questions needed...';
      case 'rapid-fire':
        return 'Describe the type of rapid-fire questions needed...';
      case 'conductor':
        return 'Describe the topics for conductor assessment...';
      case 'triple-step':
        return 'Describe the type of triple-step questions needed...';
      default:
        return 'Describe the type of questions needed...';
    }
  };

  const handleGenerate = async () => {
    if (!canGenerate) {
      toast({
        title: "Missing Information",
        description: "Please fill in the number of questions and assessment type first.",
        variant: "destructive",
      });
      return;
    }

    if (!query.trim()) {
      toast({
        title: "Query Required",
        description: "Please describe the type of questions you need.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        query: query.trim(),
        num_questions: numQuestions
      };

      if (assessmentType === 'triple-step' && numWords) {
        payload.num_words = numWords;
      }

      const response = await fetch(getApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to generate questions');
      }

      const result = await response.json();
      
      if (result.status === 'success' && result.data) {
        setGeneratedData(result.data);
        onQuestionsGenerated(result.data);
        toast({
          title: "Questions Generated",
          description: "AI has successfully generated your questions!",
        });
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate questions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderQuestions = () => {
    if (!generatedData) return null;

    if (assessmentType === 'conductor') {
      return (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Topics ({generatedData.topics?.length || 0})</h4>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {generatedData.topics?.map((topic: string, index: number) => (
                <div key={index} className="p-3 bg-muted/50 rounded-lg text-sm">
                  {topic}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (assessmentType === 'triple-step') {
      return (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Questions ({generatedData.questions?.length || 0})</h4>
            <div className="max-h-32 overflow-y-auto space-y-2">
              {generatedData.questions?.map((q: any, index: number) => (
                <div key={q.id || index} className="p-3 bg-muted/50 rounded-lg text-sm">
                  <span className="font-medium">Q{q.id}: </span>
                  {q.text}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-medium mb-2">Words ({generatedData.words?.length || 0})</h4>
            <div className="max-h-32 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {generatedData.words?.map((word: string, index: number) => (
                  <span key={index} className="px-2 py-1 bg-primary/10 text-primary rounded text-sm">
                    {word}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // QA and rapid-fire
    return (
      <div className="space-y-4">
        <h4 className="font-medium">Questions ({generatedData.questions?.length || 0})</h4>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {generatedData.questions?.map((q: any, index: number) => (
            <div key={q.id || index} className="p-3 bg-muted/50 rounded-lg text-sm">
              <span className="font-medium">Q{q.id}: </span>
              {q.text}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (assessmentType === 'games-arena') {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-center text-muted-foreground">
          <p>Games Arena assessments use predefined games.</p>
          <p>No question generation needed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h3 className="font-medium">AI Question Generator</h3>
        <p className="text-sm text-muted-foreground">
          Generate {assessmentType} questions using AI
        </p>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 p-4">
        {!canGenerate ? (
          <div className="flex items-center justify-center h-full text-center text-muted-foreground">
            <div>
              <p className="mb-2">Please fill in:</p>
              <ul className="text-sm space-y-1">
                <li>• Number of questions</li>
                <li>• Assessment type</li>
                {assessmentType === 'triple-step' && <li>• Number of words</li>}
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4 h-full flex flex-col">
            {/* Generated Questions Display */}
            {generatedData && (
              <div className="flex-1 overflow-hidden">
                {renderQuestions()}
              </div>
            )}
            
            {/* Input Area */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={getPlaceholder()}
                  className="flex-1"
                  onKeyPress={(e) => e.key === 'Enter' && !loading && handleGenerate()}
                  disabled={loading}
                />
                <Button 
                  onClick={handleGenerate}
                  disabled={loading || !canGenerate}
                  size="sm"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
