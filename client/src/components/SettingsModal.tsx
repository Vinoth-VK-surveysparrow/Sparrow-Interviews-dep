import * as React from "react";
import { useState, useEffect } from "react";
import { Settings, Camera, Mic, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

interface PermissionStatus {
  granted: boolean;
  denied: boolean;
  testing: boolean;
}

interface SettingsModalProps {
  children?: React.ReactNode;
}

export default function SettingsModal({ children }: SettingsModalProps) {
  const [open, setOpen] = useState(false);

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

  // Listen for open settings modal event
  useEffect(() => {
    const handleOpenSettings = () => {
      setOpen(true);
    };

    window.addEventListener('open-settings-modal', handleOpenSettings);

    return () => {
      window.removeEventListener('open-settings-modal', handleOpenSettings);
    };
  }, []);

  // Permission testing functions
  const testCameraPermission = async () => {
    setCameraStatus(prev => ({ ...prev, testing: true }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStatus({ granted: true, denied: false, testing: false });
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      setCameraStatus({ granted: false, denied: true, testing: false });
    }
  };

  const testMicPermission = async () => {
    setMicStatus(prev => ({ ...prev, testing: true }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStatus({ granted: true, denied: false, testing: false });
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      setMicStatus({ granted: false, denied: true, testing: false });
    }
  };

  // Check permissions on mount
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const permissions = await Promise.all([
          navigator.permissions.query({ name: 'camera' as PermissionName }),
          navigator.permissions.query({ name: 'microphone' as PermissionName })
        ]);

        setCameraStatus({
          granted: permissions[0].state === 'granted',
          denied: permissions[0].state === 'denied',
          testing: false,
        });

        setMicStatus({
          granted: permissions[1].state === 'granted',
          denied: permissions[1].state === 'denied',
          testing: false,
        });
      } catch (error) {
        // Fallback: test permissions directly
        testCameraPermission();
        testMicPermission();
      }
    };

    if (open) {
      checkPermissions();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your assessment preferences and test system permissions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Camera Permission */}
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="inline-flex size-6 items-center justify-center rounded-sm bg-muted text-sm text-foreground">
                1
              </div>
              <Label className="text-sm font-medium text-foreground">Camera Permission</Label>
            </div>
            <p className="text-xs text-muted-foreground ml-9">
              Required for video monitoring during assessments.
            </p>
            <div className="ml-9 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Camera className="h-4 w-4" />
                {cameraStatus.granted && <CheckCircle className="h-4 w-4 text-green-500" />}
                {cameraStatus.denied && <XCircle className="h-4 w-4 text-red-500" />}
                <span className="text-sm">
                  {cameraStatus.granted ? 'Granted' : cameraStatus.denied ? 'Denied' : 'Not tested'}
                </span>
              </div>
              <Button
                onClick={testCameraPermission}
                disabled={cameraStatus.testing}
                size="sm"
                variant="outline"
              >
                {cameraStatus.testing ? 'Testing...' : 'Test Camera'}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Microphone Permission */}
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="inline-flex size-6 items-center justify-center rounded-sm bg-muted text-sm text-foreground">
                2
              </div>
              <Label className="text-sm font-medium text-foreground">Microphone Permission</Label>
            </div>
            <p className="text-xs text-muted-foreground ml-9">
              Required for audio recording during assessments.
            </p>
            <div className="ml-9 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Mic className="h-4 w-4" />
                {micStatus.granted && <CheckCircle className="h-4 w-4 text-green-500" />}
                {micStatus.denied && <XCircle className="h-4 w-4 text-red-500" />}
                <span className="text-sm">
                  {micStatus.granted ? 'Granted' : micStatus.denied ? 'Denied' : 'Not tested'}
                </span>
              </div>
              <Button
                onClick={testMicPermission}
                disabled={micStatus.testing}
                size="sm"
                variant="outline"
              >
                {micStatus.testing ? 'Testing...' : 'Test Microphone'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}