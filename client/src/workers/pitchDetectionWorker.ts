// Pitch Detection Worker - Improved JavaScript implementation based on pitch-detection-app approach
// Implements advanced autocorrelation and YIN (McLeod) algorithms for accurate pitch detection

export interface PitchResult {
  frequency: number;
  clarity: number;
}

export type PitchDetectorType = 'autocorrelation' | 'mcleod';

class PitchDetectionWorker {
  private initialized = false;
  private detectorType: PitchDetectorType = 'mcleod';
  private windowSize = 8192;
  private padding = 4096;

  async initialize() {
    if (this.initialized) return;

    this.initialized = true;
    console.log('🎵 Pitch detection worker initialized (JavaScript implementation)');
  }

  createDetector(type: PitchDetectorType, windowSize: number, padding?: number): void {
    this.detectorType = type;
    this.windowSize = windowSize;
    this.padding = padding || Math.floor(windowSize / 2);
    console.log(`🎵 Created ${type} detector (window: ${windowSize}, padding: ${this.padding})`);
  }

  /**
   * Get pitch using improved algorithms
   */
  getPitch(
    signal: Float32Array,
    sampleRate: number,
    powerThreshold: number,
    clarityThreshold: number
  ): PitchResult | null {
    if (!this.initialized) {
      throw new Error('Pitch detection worker not initialized');
    }

    try {
      // Calculate RMS power for initial voice detection
      let power = 0;
      for (let i = 0; i < signal.length; i++) {
        power += signal[i] * signal[i];
      }
      power = Math.sqrt(power / signal.length);

      if (power < powerThreshold) {
        return null; // Not enough signal power
      }

      let frequency = 0;
      let clarity = 0;

      switch (this.detectorType) {
        case 'autocorrelation':
          const autocorrResult = this.autocorrelationPitchDetection(signal, sampleRate, clarityThreshold);
          frequency = autocorrResult.frequency;
          clarity = autocorrResult.clarity;
          break;

        case 'mcleod':
          const yinResult = this.yinPitchDetection(signal, sampleRate, clarityThreshold);
          frequency = yinResult.frequency;
          clarity = yinResult.clarity;
          break;

        default:
          throw new Error(`Unknown detector type: ${this.detectorType}`);
      }

      if (frequency > 0 && clarity >= clarityThreshold) {
        return { frequency, clarity };
      } else {
        return null;
      }
    } catch (error) {
      console.error('❌ Error in pitch detection:', error);
      return null;
    }
  }

  /**
   * Improved autocorrelation pitch detection
   */
  private autocorrelationPitchDetection(
    signal: Float32Array,
    sampleRate: number,
    clarityThreshold: number
  ): { frequency: number; clarity: number } {
    const bufferSize = Math.min(signal.length, this.windowSize);
    const minPeriod = Math.floor(sampleRate / 1000); // Min ~1000Hz
    const maxPeriod = Math.floor(sampleRate / 75);   // Max ~75Hz

    let bestPeriod = 0;
    let bestCorrelation = 0;

    // Calculate autocorrelation for different periods
    for (let period = minPeriod; period < maxPeriod; period++) {
      let correlation = 0;
      let normalizer = 0;

      // Calculate correlation with normalization (similar to YIN)
      for (let i = 0; i < bufferSize - period; i++) {
        correlation += signal[i] * signal[i + period];
        normalizer += signal[i] * signal[i] + signal[i + period] * signal[i + period];
      }

      if (normalizer > 0) {
        correlation = (2 * correlation) / normalizer;

        // Apply lag windowing for better accuracy
        const lagWindow = 1 - (period / maxPeriod);
        correlation *= lagWindow;

        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestPeriod = period;
        }
      }
    }

    if (bestPeriod === 0 || bestCorrelation < clarityThreshold) {
      return { frequency: 0, clarity: 0 };
    }

    // Parabolic interpolation for sub-sample accuracy
    const interpolatedPeriod = this.parabolicInterpolation(signal, bestPeriod, bufferSize);
    const frequency = sampleRate / interpolatedPeriod;

    return {
      frequency: Math.max(75, Math.min(1000, frequency)), // Clamp to reasonable range
      clarity: bestCorrelation
    };
  }

  /**
   * YIN (McLeod) pitch detection algorithm
   */
  private yinPitchDetection(
    signal: Float32Array,
    sampleRate: number,
    clarityThreshold: number
  ): { frequency: number; clarity: number } {
    const bufferSize = Math.min(signal.length, this.windowSize);
    const halfBufferSize = Math.floor(bufferSize / 2);

    // Step 1: Calculate difference function
    const difference = new Float32Array(halfBufferSize);
    for (let tau = 0; tau < halfBufferSize; tau++) {
      for (let i = 0; i < halfBufferSize; i++) {
        const delta = signal[i] - signal[i + tau];
        difference[tau] += delta * delta;
      }
    }

    // Step 2: Calculate cumulative mean normalized difference function
    const cmndf = new Float32Array(halfBufferSize);
    cmndf[0] = 1; // First value is always 1

    let runningSum = 0;
    for (let tau = 1; tau < halfBufferSize; tau++) {
      runningSum += difference[tau];
      cmndf[tau] = difference[tau] * tau / runningSum;
    }

    // Step 3: Absolute threshold
    const threshold = 0.15; // Typical YIN threshold
    let tau = 2; // Start from tau=2

    // Find first minimum below threshold
    while (tau < halfBufferSize) {
      if (cmndf[tau] < threshold) {
        // Check if this is a local minimum
        while (tau + 1 < halfBufferSize && cmndf[tau + 1] < cmndf[tau]) {
          tau++;
        }
        break;
      }
      tau++;
    }

    if (tau === halfBufferSize) {
      return { frequency: 0, clarity: 0 }; // No pitch found
    }

    // Parabolic interpolation for better accuracy
    const interpolatedTau = this.parabolicInterpolationForYIN(cmndf, tau);

    // Calculate frequency
    const frequency = sampleRate / interpolatedTau;

    // Calculate clarity (inverse of CMNDF value)
    const clarity = Math.max(0, 1 - cmndf[Math.floor(interpolatedTau)]);

    if (clarity < clarityThreshold) {
      return { frequency: 0, clarity: 0 };
    }

    return {
      frequency: Math.max(75, Math.min(1000, frequency)), // Clamp to reasonable range
      clarity: clarity
    };
  }

  /**
   * Parabolic interpolation for autocorrelation
   */
  private parabolicInterpolation(signal: Float32Array, period: number, bufferSize: number): number {
    if (period <= 0 || period >= bufferSize - 1) {
      return period;
    }

    // Get values around the peak
    let correlation = 0;
    let normalizer = 0;

    for (let i = 0; i < bufferSize - period; i++) {
      correlation += signal[i] * signal[i + period];
      normalizer += signal[i] * signal[i] + signal[i + period] * signal[i + period];
    }

    const y1 = normalizer > 0 ? (2 * correlation) / normalizer : 0;

    // Calculate neighboring correlations
    const prevPeriod = period - 1;
    const nextPeriod = period + 1;

    let prevCorr = 0;
    let prevNorm = 0;
    for (let i = 0; i < bufferSize - prevPeriod; i++) {
      prevCorr += signal[i] * signal[i + prevPeriod];
      prevNorm += signal[i] * signal[i] + signal[i + prevPeriod] * signal[i + prevPeriod];
    }
    const y0 = prevNorm > 0 ? (2 * prevCorr) / prevNorm : 0;

    let nextCorr = 0;
    let nextNorm = 0;
    for (let i = 0; i < bufferSize - nextPeriod; i++) {
      nextCorr += signal[i] * signal[i + nextPeriod];
      nextNorm += signal[i] * signal[i] + signal[i + nextPeriod] * signal[i + nextPeriod];
    }
    const y2 = nextNorm > 0 ? (2 * nextCorr) / nextNorm : 0;

    // Parabolic interpolation
    const a = (y0 - 2 * y1 + y2) / 2;
    const b = (y2 - y0) / 2;

    if (Math.abs(a) > 0.0001) {
      const offset = -b / (2 * a);
      if (Math.abs(offset) <= 1) {
        return period + offset;
      }
    }

    return period;
  }

  /**
   * Parabolic interpolation for YIN algorithm
   */
  private parabolicInterpolationForYIN(cmndf: Float32Array, tau: number): number {
    if (tau <= 0 || tau >= cmndf.length - 1) {
      return tau;
    }

    const x0 = tau - 1;
    const x1 = tau;
    const x2 = tau + 1;

    const y0 = cmndf[x0];
    const y1 = cmndf[x1];
    const y2 = cmndf[x2];

    // Parabolic interpolation formula
    const a = (y0 - 2 * y1 + y2) / 2;
    const b = (y2 - y0) / 2;

    if (Math.abs(a) > 0.0001) {
      const offset = -b / (2 * a);
      return x1 + offset;
    }

    return tau;
  }

  cleanup(): void {
    this.initialized = false;
  }
}

// Singleton instance for the worker
const pitchWorker = new PitchDetectionWorker();

export default pitchWorker;
