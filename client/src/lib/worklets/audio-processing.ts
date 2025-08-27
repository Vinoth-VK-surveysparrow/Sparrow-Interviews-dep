const AudioRecorderWorkletSource = `
class AudioRecorderWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isRecording = true;
  }

  process(inputs, outputs, parameters) {
    if (this.isRecording && inputs[0] && inputs[0][0]) {
      const inputData = inputs[0][0];
      
      // Convert Float32Array to Int16Array
      const int16Array = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        // Clamp and convert to 16-bit
        const sample = Math.max(-1, Math.min(1, inputData[i]));
        int16Array[i] = sample * 0x7FFF;
      }
      
      this.port.postMessage({
        data: {
          int16arrayBuffer: int16Array.buffer
        }
      });
    }
    
    return true;
  }
}

registerProcessor('audio-recorder-worklet', AudioRecorderWorklet);
`;

export default AudioRecorderWorkletSource;
