const VolMeterWorkletSource = `
class VolMeterWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.volume = 0;
    this.updateIntervalInMS = 25;
    this.nextUpdateFrame = this.updateIntervalInMS;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    
    if (input.length > 0) {
      const samples = input[0];
      let sum = 0;
      let rms = 0;
      
      // Calculate RMS
      for (let i = 0; i < samples.length; ++i) {
        sum += samples[i] * samples[i];
      }
      rms = Math.sqrt(sum / samples.length);
      this.volume = Math.max(rms, this.volume * 0.95);
    }
    
    // Update on frames
    this.nextUpdateFrame -= 128;
    if (this.nextUpdateFrame < 0) {
      this.nextUpdateFrame += this.updateIntervalInMS;
      this.port.postMessage({ volume: this.volume });
    }
    
    return true;
  }
}

// Register the processor with both names for compatibility
registerProcessor('vu-meter', VolMeterWorklet);
registerProcessor('vumeter-out', VolMeterWorklet);
`;

export default VolMeterWorkletSource;
