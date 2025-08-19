"use client";

import * as React from "react";
import { useState } from "react";
import { Camera, Mic, Settings, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";

interface PermissionStatus {
  granted: boolean;
  denied: boolean;
  testing: boolean;
  error?: string;
}

export default function PermissionsTest() {
  const [open, setOpen] = useState(false);
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Test Permissions</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="overflow-visible p-0 sm:max-w-2xl gap-0">
        <DialogHeader className="border-b px-6 py-4 mb-0">
          <DialogTitle>Camera & Microphone Permissions Test</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col-reverse md:flex-row">
          <div className="flex flex-col justify-between md:w-80 md:border-r">
            <div className="flex-1 grow">
              <div className="border-t p-6 md:border-none">
                <div className="flex items-center space-x-3">
                  <div className="inline-flex shrink-0 items-center justify-center rounded-sm bg-muted p-3">
                    <Settings
                      className="size-5 text-foreground"
                      aria-hidden={true}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-medium text-foreground">
                      Permission Tester
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Test your device permissions
                    </p>
                  </div>
                </div>
                <Separator className="my-4" />
                <h4 className="text-sm font-medium text-foreground">
                  Description
                </h4>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  This tool tests if your browser can access your camera and microphone for assessments.
                </p>
      
              </div>
            </div>
            <div className="flex items-center justify-between border-t p-4">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button type="button" size="sm" onClick={testAllPermissions}>
                Test All
              </Button>
            </div>
          </div>

          <div className="flex-1 space-y-6 p-6 md:px-6 md:pb-8 md:pt-6">
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <div className="inline-flex size-6 items-center justify-center rounded-sm bg-muted text-sm text-foreground">
                  1
                </div>
                <Label className="text-sm font-medium text-foreground">
                  Camera Permission Test
                </Label>
              </div>
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
                <p className="text-xs text-red-600 mt-1">{cameraStatus.error}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <div className="inline-flex size-6 items-center justify-center rounded-sm bg-muted text-sm text-foreground">
                  2
                </div>
                <Label className="text-sm font-medium text-foreground">
                  Microphone Permission Test
                </Label>
              </div>
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
                <p className="text-xs text-red-600 mt-1">{micStatus.error}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <div className="inline-flex size-6 items-center justify-center rounded-sm bg-muted text-sm text-foreground">
                  3
                </div>
                <Label className="text-sm font-medium text-foreground">
                  Permission Status
                </Label>
              </div>
              <div className="p-3 border rounded-md bg-muted/30">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Camera:</span>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(cameraStatus)}
                      <span className="text-sm text-muted-foreground">
                        {getStatusText(cameraStatus)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Microphone:</span>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(micStatus)}
                      <span className="text-sm text-muted-foreground">
                        {getStatusText(micStatus)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              {(cameraStatus.granted && micStatus.granted) && (
                <div className="flex items-center gap-2 text-green-600 text-sm mt-2">
                  <CheckCircle className="size-4" />
                  All permissions granted! You're ready for assessments.
                </div>
              )}
              {(cameraStatus.denied || micStatus.denied) && (
                <div className="text-xs text-muted-foreground mt-2">
                  <p>If permissions were denied, you may need to:</p>
                  <ul className="list-disc ml-4 mt-1">
                    <li>Click the camera/microphone icon in your browser's address bar</li>
                    <li>Go to browser settings and allow camera/microphone for this site</li>
                    <li>Refresh the page and try again</li>
                  </ul>
                </div>
              )}
            </div>


          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 