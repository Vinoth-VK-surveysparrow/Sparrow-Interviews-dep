// Types for pitch detection worker
export interface PitchResult {
  frequency: number;
  clarity: number;
}

export type PitchDetectorType = 'autocorrelation' | 'mcleod';

export interface PitchDetectionConfig {
  detectorType: PitchDetectorType;
  windowSize: number;
  powerThreshold: number;
  clarityThreshold: number;
}
