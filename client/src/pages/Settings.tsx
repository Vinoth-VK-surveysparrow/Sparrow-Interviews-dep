import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Home, Save, Eye, EyeOff, Key, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Settings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Load saved API key on component mount
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setGeminiApiKey(savedKey);
    }
  }, []);

  const handleSaveApiKey = async () => {
    if (!geminiApiKey.trim()) {
      toast({
        variant: 'destructive',
        title: 'Invalid API Key',
        description: 'Please enter a valid Gemini API key.',
      });
      return;
    }

    setIsSaving(true);
    try {
      // Save to localStorage
      localStorage.setItem('gemini_api_key', geminiApiKey.trim());
      
      toast({
        title: 'API Key Saved',
        description: 'Your Gemini API key has been saved successfully.',
      });
    } catch (error) {
      console.error('Error saving API key:', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: 'Failed to save the API key. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    if (!geminiApiKey.trim()) {
      toast({
        variant: 'destructive',
        title: 'No API Key',
        description: 'Please enter an API key before testing the connection.',
      });
      return;
    }

    setIsTestingConnection(true);
    try {
      // Test the API key by making a simple request to the Gemini API
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey.trim()}`);
      
      if (response.ok) {
        toast({
          title: 'Connection Successful',
          description: 'Your Gemini API key is valid and working.',
        });
      } else if (response.status === 403) {
        toast({
          variant: 'destructive',
          title: 'Invalid API Key',
          description: 'The provided API key is invalid or does not have the required permissions.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Connection Failed',
          description: 'Unable to connect to Gemini API. Please check your API key.',
        });
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      toast({
        variant: 'destructive',
        title: 'Connection Test Failed',
        description: 'Unable to test the connection. Please check your internet connection.',
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const clearApiKey = () => {
    setGeminiApiKey('');
    localStorage.removeItem('gemini_api_key');
    toast({
      title: 'API Key Cleared',
      description: 'Your Gemini API key has been removed.',
    });
  };

  const goHome = () => {
    setLocation('/dashboard');
  };

  const hasApiKey = geminiApiKey.trim().length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <Button
            variant="outline"
            onClick={goHome}
            className="flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            Back to Dashboard
          </Button>
          <Badge variant="secondary" className="text-sm">
            Settings
          </Badge>
        </div>

        <div className="space-y-6">
          {/* Page Title */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Assessment Settings
            </h1>
            <p className="text-gray-600">
              Configure your API keys and assessment preferences
            </p>
          </div>

          {/* Gemini API Key Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Gemini API Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gemini-api-key">
                  Google Gemini API Key
                </Label>
                <div className="relative">
                  <Input
                    id="gemini-api-key"
                    type={showApiKey ? 'text' : 'password'}
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="Enter your Gemini API key..."
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-sm text-gray-500">
                  This key is required for the Sales AI Cue Card assessment. 
                  Your key is stored locally in your browser.
                </p>
              </div>

              {/* API Key Status */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50">
                {hasApiKey ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-700">API key configured</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    <span className="text-sm text-orange-700">No API key configured</span>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleSaveApiKey}
                  disabled={isSaving || !geminiApiKey.trim()}
                  className="flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save API Key'}
                </Button>

                <Button
                  variant="outline"
                  onClick={testConnection}
                  disabled={isTestingConnection || !geminiApiKey.trim()}
                  className="flex items-center gap-2"
                >
                  {isTestingConnection ? 'Testing...' : 'Test Connection'}
                </Button>

                {hasApiKey && (
                  <Button
                    variant="destructive"
                    onClick={clearApiKey}
                    className="flex items-center gap-2"
                  >
                    Clear API Key
                  </Button>
                )}
              </div>

              {/* Instructions */}
              <div className="mt-6 p-4 border rounded-lg bg-blue-50 border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">How to get your Gemini API Key:</h4>
                <ol className="text-sm text-blue-800 space-y-1">
                  <li>1. Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-900">Google AI Studio</a></li>
                  <li>2. Sign in with your Google account</li>
                  <li>3. Click "Create API Key"</li>
                  <li>4. Copy the generated key and paste it above</li>
                  <li>5. Save the key to enable the Sales AI assessment</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Additional Settings (for future use) */}
          <Card>
            <CardHeader>
              <CardTitle>Assessment Preferences</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <div>
                    <h4 className="font-medium">Sales AI Assessment</h4>
                    <p className="text-sm text-gray-600">Advanced AI-powered sales scenario training</p>
                  </div>
                  <Badge variant={hasApiKey ? "default" : "secondary"}>
                    {hasApiKey ? "Available" : "API Key Required"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
