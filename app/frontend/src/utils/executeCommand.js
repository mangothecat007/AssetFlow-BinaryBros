import { api, BACKEND_URL } from "../lib/api";
import { startGlobalTracking } from "../utils/LocationTracker";

export const executeCommand = async (
  cmd,
  { navigate, toast, speak, toggle },
) => {
  switch (cmd.action) {
    case "navigate":
      // Sanitize path: strip leading slash for internal state navigation
      const target = cmd.to === "/" ? "home" : cmd.to.replace(/^\//, "");
      if (target === "terminal") {
        if (scopes.includes("write:system")) {
          navigate(target);
        } else {
          toast?.error?.("Unauthorized action");
        }
      } else {
        navigate(target);
      }
      break;

    case "refresh":
      window.location.reload();
      break;
    case "toggleVoice":
      // Use a small timeout so the TTS has a chance to start before the module stops
      setTimeout(() => toggle?.(), 500);
      break;
    case "pass":
      // Do nothing
      break;
    case "toggledark":
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("onealert-theme", "dark");
      toast?.success?.(`Theme set to dark`);
      break;
    case "togglegrey":
      document.documentElement.setAttribute("data-theme", "grey");
      localStorage.setItem("onealert-theme", "grey");
      toast?.success?.(`Theme set to grey`);
      break;
    case "togglelight":
      document.documentElement.setAttribute("data-theme", "light");
      localStorage.setItem("onealert-theme", "light");
      toast?.success?.(`Theme set to light`);
      break;

    case "triggerSOS":
      toast?.error?.("SOS Triggered via Voice!");
      const triggerVoiceSOS = async (lat = 0, lng = 0, accuracy = 0) => {
        const incId = `INC-${Date.now()}`;
        try {
          await fetch(`${BACKEND_URL}/api/incident`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: incId,
              type: "physical_sos",
              trigger_type: "voice",
              status: "active",
              severity: "critical",
              timestamp: new Date().toISOString(),
              last_updated: new Date().toISOString(),
              user: {
                user_id: "usr_citizen",
                name: "Citizen User",
                phone: "+91 0000000000",
                emergency_contacts_notified: false
              },
              location: { lat, lng, accuracy, is_live_tracking: true },
              evidence: []
            })
          });
        } catch (e) {
          console.error("Failed to sync SOS:", e);
        }

        if ("geolocation" in navigator) {
          startGlobalTracking(incId);
        }
        
        const num = import.meta.env.VITE_EMERGENCY_NUMBER;
        if (num) {
          window.location.href = `tel:${num}`;
        } else {
          toast?.error?.("Emergency number not configured in .env");
        }
      };

      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => triggerVoiceSOS(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
          (err) => triggerVoiceSOS()
        );
      } else {
        triggerVoiceSOS();
      }
      break;

    case "triggerSilentSOS":
      const doSilentSOS = async (lat = 0, lng = 0, accuracy = 0) => {
        const incId = `INC-${Date.now()}`;
        try {
          fetch(`${BACKEND_URL}/api/incident`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: incId,
              type: "physical_sos",
              trigger_type: "silent_panic",
              status: "active",
              severity: "critical",
              timestamp: new Date().toISOString(),
              last_updated: new Date().toISOString(),
              user: {
                user_id: "usr_citizen",
                name: "Citizen User",
                phone: "+91 0000000000",
                emergency_contacts_notified: false
              },
              location: { lat, lng, accuracy, is_live_tracking: true },
              evidence: []
            })
          }).catch(() => {});

          if ("geolocation" in navigator) {
            startGlobalTracking(incId);
          }
        } catch (e) {}
      };

      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => doSilentSOS(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
          (err) => doSilentSOS()
        );
      } else {
        doSilentSOS();
      }
      break;

    case "unknown":
      toast?.error?.(`Unknown command: "${cmd.original}"`);
      break;
    default:
      toast?.error?.("Unauthorized command");
  }
  const scopes = (window.__USER_SCOPE__ || "").split(" ");
  if (scopes.includes("write:system")) {
    try {

    } catch (err) {
      toast?.error?.(`Failed to execute ${cmd.action}: ${err.message}`);
    }
  }
};
