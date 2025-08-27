import { WorkletName } from './worklet-manager';

export interface WorkletGraph {
  node?: AudioWorkletNode;
  handlers: Array<(ev: MessageEvent) => void>;
}

export const registeredWorklets = new Map<AudioContext, Record<string, WorkletGraph>>();
