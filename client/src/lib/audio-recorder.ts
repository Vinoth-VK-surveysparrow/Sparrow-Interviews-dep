import { audioContext } from "./utils";
import { ensureWorkletLoaded } from "./worklet-manager";
import EventEmitter from "eventemitter3";

function arrayBufferToBase64(buffer: ArrayBuffer) {
  var binary = "";
  var bytes = new Uint8Array(buffer);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export class AudioRecorder extends EventEmitter {
  stream: MediaStream | undefined;
  audioContext: AudioContext | undefined;
  source: MediaStreamAudioSourceNode | undefined;
  recording: boolean = false;
  recordingWorklet: AudioWorkletNode | undefined;
  vuWorklet: AudioWorkletNode | undefined;

  private starting: Promise<void> | null = null;

  constructor(public sampleRate = 16000) {
    super();
  }

  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Could not request user media");
    }

    if (this.starting) {
      console.log("AudioRecorder start already in progress, waiting...");
      return this.starting;
    }

    this.starting = new Promise(async (resolve, reject) => {
      try {
        console.log("Starting AudioRecorder...");
        
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = await audioContext({ sampleRate: this.sampleRate });
      this.source = this.audioContext.createMediaStreamSource(this.stream);

        // Load recording worklet using centralized manager
        await ensureWorkletLoaded(this.audioContext, 'audio-recorder-worklet');

      this.recordingWorklet = new AudioWorkletNode(
        this.audioContext,
          'audio-recorder-worklet',
      );

      this.recordingWorklet.port.onmessage = async (ev: MessageEvent) => {
        // worklet processes recording floats and messages converted buffer
          const arrayBuffer = ev.data.data?.int16arrayBuffer;

        if (arrayBuffer) {
          const arrayBufferString = arrayBufferToBase64(arrayBuffer);
          this.emit("data", arrayBufferString);
        }
      };
      this.source.connect(this.recordingWorklet);

        // Load VU meter worklet using centralized manager
        await ensureWorkletLoaded(this.audioContext, 'vu-meter');
        
        this.vuWorklet = new AudioWorkletNode(this.audioContext, 'vu-meter');
      this.vuWorklet.port.onmessage = (ev: MessageEvent) => {
        this.emit("volume", ev.data.volume);
      };

      this.source.connect(this.vuWorklet);
      this.recording = true;
        
        console.log("AudioRecorder started successfully");
      resolve();
      } catch (error) {
        console.error("Error starting AudioRecorder:", error);
        reject(error);
      } finally {
      this.starting = null;
      }
    });

    return this.starting;
  }

  stop() {
    console.log("Stopping AudioRecorder...");
    
    // its plausible that stop would be called before start completes
    // such as if the websocket immediately hangs up
    const handleStop = () => {
      try {
      this.source?.disconnect();
        this.recordingWorklet?.disconnect();
        this.vuWorklet?.disconnect();
      this.stream?.getTracks().forEach((track) => track.stop());
      this.stream = undefined;
      this.recordingWorklet = undefined;
      this.vuWorklet = undefined;
        this.recording = false;
        console.log("AudioRecorder stopped successfully");
      } catch (error) {
        console.error("Error stopping AudioRecorder:", error);
      }
    };
    
    if (this.starting) {
      this.starting.then(handleStop).catch(() => handleStop());
      return;
    }
    handleStop();
  }
}
