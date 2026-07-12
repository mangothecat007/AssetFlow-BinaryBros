import { useState, useCallback } from "react";

export const useMicPermission = () => {
  const [status, setStatus] = useState("idle");
  const [transcript, setTranscript] = useState("");
  const [volume, setVolume] = useState(0);

  const requestPermission = useCallback(async () => {
    setStatus("prompting");
    setTranscript("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStatus("granted");

      // 1. Audio Level Monitor
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setVolume(avg);
        requestAnimationFrame(updateVolume);
      };
      updateVolume();

      // 2. Speech Recognition (Cloud Fix)
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const r = new SpeechRecognition();

        // Use user's exact browser/OS language
        r.lang = navigator.language || "en-US";
        r.continuous = false; // False is often more stable for single-shot cloud requests
        r.interimResults = true;
        r.maxAlternatives = 3; // Get more guesses from server

        r.onresult = (e) => {
          const text = e.results[0][0].transcript;
          setTranscript(text);
          console.log(`🎙️ [CLOUD] "${text}" (${e.results[0][0].confidence.toFixed(2)})`);
        };

        r.onend = () => {
          console.log("🎙️ [CYCLE END]");
          if (status === "granted") {
            // Only restart if we haven't hit a network error
            setTimeout(() => {
              try {
                r.start();
              } catch (e) {
                console.error("Restart blocked", e);
              }
            }, 1000);
          }
        };

        r.onerror = (e) => {
          if (e.error === 'network') {
            setStatus("error"); // Stop the auto-restart loop on network failure
            console.error("Network block detected. Stopping recognition.");
          }
        };

        r.start();
      }

      return true;
    } catch (err) {
      console.error("🎙️ [HARDWARE ERROR]", err);
      setStatus("error");
      return false;
    }
  }, []);

  return { status, transcript, volume, requestPermission };
};
