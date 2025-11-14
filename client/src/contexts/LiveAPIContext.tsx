import { createContext, FC, ReactNode, useContext, useState } from "react";
import { useLiveAPI, UseLiveAPIResults } from "../hooks/use-live-api";

const LiveAPIContext = createContext<UseLiveAPIResults & {
  showApiKeyError: (message?: string) => void;
} | undefined>(undefined);

export type LiveAPIProviderProps = {
  children: ReactNode;
  url?: string;
};

export const LiveAPIProvider: FC<LiveAPIProviderProps> = ({
  url,
  children,
}) => {
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyModalMessage, setApiKeyModalMessage] = useState<string | undefined>();
  
  const showApiKeyError = (message?: string) => {
    setApiKeyModalMessage(message);
    setShowApiKeyModal(true);
  };

  const liveAPI = useLiveAPI({ 
    url, 
    onApiKeyError: showApiKeyError 
  });

  const contextValue = {
    ...liveAPI,
    showApiKeyError,
  };

  return (
    <LiveAPIContext.Provider value={contextValue}>
      {children}
      {/* We'll use a simple alert for now instead of a modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-2">Environment Setup Required</h3>
            <p className="text-gray-600 mb-4">
              {apiKeyModalMessage || "Please ensure your environment variables are configured and you're authenticated with Google Cloud."}
            </p>
            <button 
              onClick={() => setShowApiKeyModal(false)}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </LiveAPIContext.Provider>
  );
};

export const useLiveAPIContext = () => {
  const context = useContext(LiveAPIContext);
  if (!context) {
    throw new Error("useLiveAPIContext must be used within a LiveAPIProvider");
  }
  return context;
};
