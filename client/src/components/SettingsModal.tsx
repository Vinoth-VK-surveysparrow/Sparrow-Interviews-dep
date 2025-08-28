"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Settings, Camera, Mic, CheckCircle, XCircle, AlertCircle, Key, Moon, Sun, Monitor, LogOut, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/components/ThemeProvider";
import { useToast } from "@/hooks/use-toast";

interface PermissionStatus {
  granted: boolean;
  denied: boolean;
  testing: boolean;
  error?: string;
}

export default function SettingsModal() {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  // API Key states
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isApiKeySaved, setIsApiKeySaved] = useState(false);

  // Permission states
  const [cameraStatus, setCameraStatus] = useState<PermissionStatus>({
    granted: false,
    denied: false,
    testing: false,
  });
  const [micStatus, setMicStatus] = useState<PermissionStatus>({
    granted: false,
    denied: false,
    testing: false,
  });

  // Load API key from backend on component mount
  useEffect(() => {
    const loadApiKey = async () => {
      if (!user?.email) {
        return;
      }

      try {
        const encodedEmail = encodeURIComponent(user.email);
        const response = await fetch(`https://noe76r75ni.execute-api.us-west-2.amazonaws.com/api/api-key/${encodedEmail}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success' && data.data?.api_key) {
            setApiKey(data.data.api_key);
            setIsApiKeySaved(true);
          }
        }
      } catch (error) {
        console.error('Error loading API key:', error);
      }
    };

    loadApiKey();
  }, [user?.email]);

  // API Key functions
  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid API key",
        variant: "destructive",
      });
      return;
    }

    if (!user?.email) {
      toast({
        title: "Error",
        description: "Please ensure you are logged in to save the API key.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch('https://noe76r75ni.execute-api.us-west-2.amazonaws.com/api/api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          api_key: apiKey.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          setIsApiKeySaved(true);
          toast({
            title: "Success",
            description: "Gemini API key saved successfully!",
          });
        } else {
          throw new Error('Failed to save API key');
        }
      } else {
        throw new Error('Failed to save API key');
      }
    } catch (error) {
      console.error('Error saving API key:', error);
      toast({
        title: "Error",
        description: "Failed to save the API key. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveApiKey = async () => {
    if (!user?.email) {
      toast({
        title: "Error",
        description: "Please ensure you are logged in to remove the API key.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Clear from backend by saving empty string
      const response = await fetch('https://noe76r75ni.execute-api.us-west-2.amazonaws.com/api/api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          api_key: '',
        }),
      });

      if (response.ok) {
        setApiKey('');
        setIsApiKeySaved(false);
        toast({
          title: "Removed",
          description: "Gemini API key has been removed",
        });
      } else {
        throw new Error('Failed to remove API key');
      }
    } catch (error) {
      console.error('Error removing API key:', error);
      toast({
        title: "Error",
        description: "Failed to remove the API key. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Permission test functions
  const testCameraPermission = async () => {
    setCameraStatus({ granted: false, denied: false, testing: true });
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true,
        audio: false 
      });
      
      // Stop the stream immediately after getting permission
      stream.getTracks().forEach(track => track.stop());
      
      setCameraStatus({ granted: true, denied: false, testing: false });
    } catch (error) {
      console.error('Camera permission error:', error);
      setCameraStatus({ 
        granted: false, 
        denied: true, 
        testing: false,
        error: error instanceof Error ? error.message : 'Camera access denied'
      });
    }
  };

  const testMicrophonePermission = async () => {
    setMicStatus({ granted: false, denied: false, testing: true });
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true,
        video: false 
      });
      
      // Stop the stream immediately after getting permission
      stream.getTracks().forEach(track => track.stop());
      
      setMicStatus({ granted: true, denied: false, testing: false });
    } catch (error) {
      console.error('Microphone permission error:', error);
      setMicStatus({ 
        granted: false, 
        denied: true, 
        testing: false,
        error: error instanceof Error ? error.message : 'Microphone access denied'
      });
    }
  };

  const testAllPermissions = async () => {
    await Promise.all([
      testCameraPermission(),
      testMicrophonePermission()
    ]);
  };

  const getStatusIcon = (status: PermissionStatus) => {
    if (status.testing) {
      return <AlertCircle className="size-4 text-yellow-500 animate-pulse" />;
    }
    if (status.granted) {
      return <CheckCircle className="size-4 text-green-500" />;
    }
    if (status.denied) {
      return <XCircle className="size-4 text-red-500" />;
    }
    return <div className="size-4 bg-gray-300 rounded-full" />;
  };

  const getStatusText = (status: PermissionStatus) => {
    if (status.testing) return "Testing...";
    if (status.granted) return "Granted";
    if (status.denied) return "Denied";
    return "Not tested";
  };

  // Theme functions
  const themeOptions = [
    { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
    { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
    { value: 'system', label: 'System', icon: <Monitor className="h-4 w-4" /> },
  ];

  const getCurrentThemeOption = () => {
    return themeOptions.find(option => option.value === theme) || themeOptions[2];
  };

  // Sign out function
  const handleSignOut = async () => {
    try {
      await signOut();
      setOpen(false);
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="overflow-visible p-0 sm:max-w-4xl gap-0">
        <DialogHeader className="border-b px-6 py-4 mb-0">
          <DialogTitle>Settings & Configuration</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col-reverse lg:flex-row">
          {/* Left Sidebar */}
          <div className="flex flex-col justify-between lg:w-80 lg:border-r">
            <div className="flex-1 grow">
              <div className="border-t p-6 lg:border-none">
                <div className="flex items-center space-x-3">
                  <div className="inline-flex shrink-0 items-center justify-center rounded-sm bg-muted p-3">
                    <Settings
                      className="size-5 text-foreground"
                      aria-hidden={true}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-medium text-foreground">
                      Application Settings
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Configure your assessment environment
                    </p>
                  </div>
                </div>
                <Separator className="my-4" />
                <h4 className="text-sm font-medium text-foreground">
                  Configuration Options
                </h4>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Set up API keys, test permissions, and customize appearance.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t p-4">
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Close
                </Button>
              </DialogClose>
              <Button 
                type="button" 
                size="sm" 
                onClick={handleSignOut}
                className="flex items-center gap-2 bg-[#4A9CA6] hover:bg-[#3a8b94] text-white"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 space-y-6 p-6 lg:px-6 lg:pb-8 lg:pt-6">
            
            {/* API Key Configuration */}
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <div className="inline-flex size-6 items-center justify-center rounded-sm bg-muted text-sm text-foreground">
                  1
                </div>
                <Label className="text-sm font-medium text-foreground">
                  Gemini API Key Configuration
                </Label>
              </div>
              <p className="text-xs text-muted-foreground ml-9">
                Required for AI-powered assessments and conversations.
              </p>
              <div className="ml-9 space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      placeholder="Enter your Gemini API key..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button
                    onClick={handleSaveApiKey}
                    disabled={!apiKey.trim()}
                    size="sm"
                  >
                    Save
                  </Button>
                </div>
                {isApiKeySaved && (
                  <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm">API key configured</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveApiKey}
                      className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Get your API key from the{" "}
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 underline"
                  >
                    Google AI Studio
                  </a>
                </p>
              </div>
            </div>

            {/* Permissions Testing */}
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <div className="inline-flex size-6 items-center justify-center rounded-sm bg-muted text-sm text-foreground">
                  2
                </div>
                <Label className="text-sm font-medium text-foreground">
                  Device Permissions
                </Label>
              </div>
              <p className="text-xs text-muted-foreground ml-9">
                Test camera and microphone access for assessments.
              </p>
              <div className="ml-9 space-y-3">
                {/* Camera Test */}
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex items-center gap-3">
                    <Camera className="size-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Camera Access</div>
                      <div className="text-xs text-muted-foreground">
                        {getStatusText(cameraStatus)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(cameraStatus)}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={testCameraPermission}
                      disabled={cameraStatus.testing}
                    >
                      {cameraStatus.testing ? "Testing..." : "Test"}
                    </Button>
                  </div>
                </div>
                {cameraStatus.error && (
                  <p className="text-xs text-red-600 ml-8">{cameraStatus.error}</p>
                )}

                {/* Microphone Test */}
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex items-center gap-3">
                    <Mic className="size-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Microphone Access</div>
                      <div className="text-xs text-muted-foreground">
                        {getStatusText(micStatus)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(micStatus)}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={testMicrophonePermission}
                      disabled={micStatus.testing}
                    >
                      {micStatus.testing ? "Testing..." : "Test"}
                    </Button>
                  </div>
                </div>
                {micStatus.error && (
                  <p className="text-xs text-red-600 ml-8">{micStatus.error}</p>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={testAllPermissions}
                  className="w-full"
                >
                  Test All Permissions
                </Button>

                {(cameraStatus.granted && micStatus.granted) && (
                  <div className="flex items-center gap-2 text-green-600 text-sm p-2 bg-green-50 dark:bg-green-900/20 rounded-md">
                    <CheckCircle className="size-4" />
                    All permissions granted! You're ready for assessments.
                  </div>
                )}
              </div>
            </div>

            {/* Theme Configuration */}
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <div className="inline-flex size-6 items-center justify-center rounded-sm bg-muted text-sm text-foreground">
                  3
                </div>
                <Label className="text-sm font-medium text-foreground">
                  Appearance Theme
                </Label>
              </div>
              <p className="text-xs text-muted-foreground ml-9">
                Choose your preferred color scheme.
              </p>
              <div className="ml-9">
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        {getCurrentThemeOption().icon}
                        {getCurrentThemeOption().label}
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {themeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          {option.icon}
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>



          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
