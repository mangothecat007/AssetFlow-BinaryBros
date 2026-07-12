import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { useVoiceCommand } from "../hooks/useVoiceCommand";

const VoiceContext = createContext(null);

export const VoiceProvider = ({ children }) => {
  const listeners = useRef(new Set());
  
  const registerListener = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  const handleCommand = useCallback((text) => {
    listeners.current.forEach(fn => fn(text));
  }, []);

  const voice = useVoiceCommand(handleCommand);

  return (
    <VoiceContext.Provider value={{ ...voice, registerListener }}>

      {children}
    </VoiceContext.Provider>
  );
};

export const useVoice = (onCommand) => {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error("useVoice must be used within a VoiceProvider");
  }

  React.useEffect(() => {
    if (onCommand) {
      return context.registerListener(onCommand);
    }
  }, [onCommand, context]);

  return context;
};
