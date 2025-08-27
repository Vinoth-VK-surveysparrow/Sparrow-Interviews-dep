import VolMeterWorkletSource from './worklets/vol-meter';
import AudioRecorderWorkletSource from './worklets/audio-processing';

export type WorkletName = 'vu-meter' | 'vumeter-out' | 'audio-recorder-worklet';

const workletSources: Record<WorkletName, string> = {
  'vu-meter': VolMeterWorkletSource,
  'vumeter-out': VolMeterWorkletSource, // AudioStreamer uses this name
  'audio-recorder-worklet': AudioRecorderWorkletSource,
};

const loadedWorklets = new Map<AudioContext, Set<WorkletName>>();

export async function ensureWorkletLoaded(
  context: AudioContext,
  workletName: WorkletName
): Promise<void> {
  // Check if worklet is already loaded for this context
  const contextWorklets = loadedWorklets.get(context) || new Set();
  if (contextWorklets.has(workletName)) {
    return;
  }

  // Get the worklet source
  const workletSource = workletSources[workletName];
  if (!workletSource) {
    throw new Error(`Unknown worklet: ${workletName}`);
  }

  try {
    // Create a blob URL for the worklet source
    const blob = new Blob([workletSource], { type: 'application/javascript' });
    const workletUrl = URL.createObjectURL(blob);

    // Load the worklet
    await context.audioWorklet.addModule(workletUrl);

    // Clean up the blob URL
    URL.revokeObjectURL(workletUrl);

    // Mark as loaded
    if (!loadedWorklets.has(context)) {
      loadedWorklets.set(context, new Set());
    }
    loadedWorklets.get(context)!.add(workletName);

    console.log(`Worklet loaded: ${workletName}`);
  } catch (error) {
    console.error(`Failed to load worklet ${workletName}:`, error);
    throw error;
  }
}
