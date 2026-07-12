import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { toast } from "react-hot-toast";

export const useVoiceCommand = (onCommand) => {
  const [engine, setEngine] = useState("cloud"); // Force cloud engine since offline was removed
  const [locale, setLocale] = useState(localStorage.getItem("onealert-voice-locale") || "en-US");
  const [listening, setListening] = useState(false);
  const onCommandRef = useRef(onCommand);

  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  // Sync with localStorage
  useEffect(() => {
    const handleStorage = () => {
      const savedLocale = localStorage.getItem("onealert-voice-locale");
      if (savedLocale && savedLocale !== locale) setLocale(savedLocale);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [locale]);

  const shouldListenRef = useRef(false);

  // --- CLOUD ENGINE (WebSpeech API) ---
  const recognition = useMemo(() => {
    if (typeof window === "undefined") return null;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const r = new SpeechRecognition();
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 5;
    r.lang = locale;

    r.onstart = () => {
      console.log("🎙️ [VOICE] Cloud Engine Started");
      setListening(true);
    };

    r.onresult = (e) => {
      const lastIndex = e.results.length - 1;
      const transcript = e.results[lastIndex][0].transcript.toLowerCase();
      const isFinal = e.results[lastIndex].isFinal;

      if (isFinal) {
        console.log("🎙️ [VOICE] Final Cloud Result:", transcript);
        onCommandRef.current(transcript);
      }
    };

    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;

      shouldListenRef.current = false;

      let message = `Cloud Error: ${e.error}`;
      if (e.error === 'service-not-allowed') message = "Cloud Engine blocked. Check firewall/browser extensions.";
      if (e.error === 'not-allowed') message = "Microphone access denied by OS or browser.";
      if (e.error === 'network') message = "Network error. Google Speech servers are unreachable.";

      console.error("🎙️ [VOICE] Cloud Error:", e.error);
      toast.error(message, { id: 'voice-error' });
      setListening(false);
    };

    r.onend = () => {
      console.log("🎙️ [VOICE] Cloud Engine Ended. shouldListen:", shouldListenRef.current);

      if (shouldListenRef.current) {
        setTimeout(() => {
          if (shouldListenRef.current) {
            try {
              r.start();
            } catch (err) {
              if (err.name !== 'InvalidStateError') {
                console.error("🎙️ [VOICE] Restart failed:", err);
                setListening(false);
              }
            }
          }
        }, 250);
      } else {
        setListening(false);
      }
    };

    return r;
  }, [locale]);

  const toggle = useCallback(() => {
    console.log("🎙️ [VOICE] Toggle called.");
    if (!recognition) {
      toast.error("Voice recognition not supported in this browser.");
      return;
    }
    if (listening) {
      shouldListenRef.current = false;
      recognition.stop();
    } else {
      shouldListenRef.current = true;
      try {
        recognition.start();
      } catch (err) {
        console.error("🎙️ [VOICE] Cloud Start failed:", err);
        setListening(false);
      }
    }
  }, [recognition, listening]);

  const updateEngine = (newEngine) => {
    // No-op since we only have cloud now
  };

  const updateLocale = (newLocale) => {
    localStorage.setItem("onealert-voice-locale", newLocale);
    setLocale(newLocale);
  };

  return {
    listening,
    toggle,
    engine,
    setEngine: updateEngine,
    locale,
    setLocale: updateLocale,
    status: listening ? "listening" : "ready",
    transcript: "",
    volume: 0,
    supported: !!recognition
  };
};


