import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MultimodalLiveAPIClientConnection,
  MultimodalLiveClient,
} from "../lib/multimodal-live-client";
import { LiveConfig } from "../multimodal-live-types";
import { AudioStreamer } from "../lib/audio-streamer";
import { audioContext } from "../lib/utils";
import VolMeterWorkletSource from "../lib/worklets/vol-meter";
import { getVertexModel } from "../services/vertexApiService";
import { tokenCache, getModelFromToken } from "../services/vertexTokenService";

export type UseLiveAPIResults = {
  client: MultimodalLiveClient;
  setConfig: (config: LiveConfig) => void;
  config: LiveConfig;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  volume: number;
  audioStreamer: AudioStreamer | null;
};

export type UseLiveAPIOptions = MultimodalLiveAPIClientConnection & {
  onApiKeyError?: (message: string) => void;
};

export function useLiveAPI({
  url,
  onApiKeyError,
}: UseLiveAPIOptions): UseLiveAPIResults {
  const clientRef = useRef<MultimodalLiveClient | null>(null);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);

  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState<LiveConfig>({
    model: getVertexModel(),
    generationConfig: {
      responseModalities: "audio",
      speechConfig: {
        voiceConfig: { 
          prebuiltVoiceConfig: { 
            voiceName: "Puck" 
          } 
        },
      }
    },
    systemInstruction: {
      parts: [
        {
          text: "You will be configured dynamically with specific persona and conversation instructions. Wait for configuration before beginning any conversation."
        }
      ],
    },
  });
  const [volume, setVolume] = useState(0);

  // register audio for streaming server -> speakers
  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: "audio-out" }).then(async (audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        console.log('🔊 Audio streamer created');
        
        // Try to add worklet, but don't fail if it doesn't work
        try {
          await audioStreamerRef.current.addWorklet<any>("vumeter-out", VolMeterWorkletSource, (ev: any) => {
            setVolume(ev.data.volume);
          });
          console.log('✅ Volume meter worklet added successfully');
        } catch (error) {
          console.warn('⚠️ Volume meter worklet failed, continuing without it:', error);
          // Audio streamer will still work for playback, just without volume meter
        }
      }).catch(error => {
        console.error('❌ Failed to create audio context:', error);
      });
    }
  }, []);

  // Initialize client on first mount
  useEffect(() => {
    if (!clientRef.current) {
      // Create initial client without token (will be recreated with token on connect)
      clientRef.current = new MultimodalLiveClient({ url });
    }
  }, [url]);


  const connect = useCallback(async () => {
    console.log(config);
    if (!config) {
      throw new Error("config has not been set");
    }

    try {
      // Resume audio context first (required for browser autoplay policies)
      if (audioStreamerRef.current) {
        console.log('🔊 Resuming audio context...');
        await audioStreamerRef.current.resume();
        console.log('✅ Audio context resumed successfully');
      }

      // Fetch a valid token before connecting
      console.log('🔑 Fetching Vertex AI token for connection...');
      const tokenData = await tokenCache.getValidToken();
      
      if (!tokenData) {
        throw new Error("Failed to fetch Vertex AI access token");
      }

      // Recreate client with the access token
      console.log('🔄 Creating new client with access token...');
      
      // CRITICAL: Remove all old event listeners before creating new client
      if (clientRef.current) {
        console.log('🧹 Cleaning up old client event listeners...');
        clientRef.current.removeAllListeners();
      }
      
      clientRef.current = new MultimodalLiveClient({ 
        url, 
        accessToken: tokenData.access_token 
      });

      // Attach event listeners to the new client (ONLY ONCE)
      const client = clientRef.current;
      
      const onOpen = () => {
        console.log("🔓 Websocket is opened");
        setConnected(true);
      };
      
      const onClose = (event: CloseEvent) => {
        setConnected(false);
        console.log('🔒 WebSocket closed:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        if (event.code === 1007 && onApiKeyError) {
          onApiKeyError("Failed to authenticate with Vertex AI. Please try again.");
        }
      };

      const stopAudioStreamer = () => audioStreamerRef.current?.stop();
      
      const onAudio = (data: ArrayBuffer) => {
        if (audioStreamerRef.current) {
          try {
            audioStreamerRef.current.addPCM16(new Uint8Array(data));
          } catch (error) {
            console.error('❌ Error adding audio to streamer:', error);
          }
        } else {
          console.warn('⚠️ Audio streamer not ready, received:', data.byteLength, 'bytes');
        }
      };

      // Register event listeners (only once per connection)
      client
        .on("open", onOpen)
        .on("close", onClose)
        .on("interrupted", stopAudioStreamer)
        .on("audio", onAudio);
      
      console.log('✅ Event listeners registered (single instance)');

      // Update config with the correct model from token response
      const updatedConfig = {
        ...config,
        model: getModelFromToken(tokenData)
      };

      console.log('🔗 Connecting to Vertex AI with token...');
      await client.connect(updatedConfig);
      // Note: setConnected(true) will be called by the "open" event handler
      console.log('✅ Connection initiated successfully');
    } catch (error) {
      console.error('❌ Failed to connect to Vertex AI:', error);
      if (onApiKeyError) {
        onApiKeyError("Failed to connect to Vertex AI. Please check your network connection and try again.");
      }
      throw error;
    }
  }, [url, config, onApiKeyError]);

  const disconnect = useCallback(async () => {
    if (clientRef.current) {
      clientRef.current.disconnect();
    }
    setConnected(false);
  }, []);

  return {
    client: clientRef.current!,
    config,
    setConfig,
    connected,
    connect,
    disconnect,
    volume,
    audioStreamer: audioStreamerRef.current,
  };
}
