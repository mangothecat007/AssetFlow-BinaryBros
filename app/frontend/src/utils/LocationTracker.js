import { BACKEND_URL } from "@/lib/api";

let worker = null;

const initWorker = () => {
  if (worker) return;

  const blob = new Blob([`
    let interval;
    self.onmessage = function(e) {
      if (e.data === 'start') {
        interval = setInterval(() => {
          self.postMessage('tick');
        }, 2000);
      } else if (e.data === 'stop') {
        clearInterval(interval);
      }
    };
  `], { type: 'application/javascript' });

  worker = new Worker(URL.createObjectURL(blob));

  worker.onmessage = () => {
    const isTracking = localStorage.getItem("location_tracking") === "true";
    const tracked = JSON.parse(localStorage.getItem("tracked_incidents") || "[]");
    
    if (!isTracking || tracked.length === 0) {
      stopGlobalTracking();
      return;
    }

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        tracked.forEach(id => {
          fetch(`${BACKEND_URL}/api/incident/${id}/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy
            })
          }).catch(() => {});
        });
      }, () => {}, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
      });
    }
  };

  worker.postMessage('start');
  window.__sos_location_worker = worker;
};

export const startGlobalTracking = (incId) => {
  let tracked = JSON.parse(localStorage.getItem("tracked_incidents") || "[]");
  if (!tracked.includes(incId)) {
    tracked.push(incId);
    localStorage.setItem("tracked_incidents", JSON.stringify(tracked));
  }
  localStorage.setItem("location_tracking", "true");

  initWorker();
};

export const resumeTrackingOnLoad = () => {
  const isTracking = localStorage.getItem("location_tracking") === "true";
  const tracked = JSON.parse(localStorage.getItem("tracked_incidents") || "[]");
  
  if (isTracking && tracked.length > 0) {
    initWorker();
  }
};

export const stopGlobalTracking = (incId = null) => {
  if (incId) {
    let tracked = JSON.parse(localStorage.getItem("tracked_incidents") || "[]");
    tracked = tracked.filter(id => id !== incId);
    localStorage.setItem("tracked_incidents", JSON.stringify(tracked));
    
    if (tracked.length === 0) {
      localStorage.setItem("location_tracking", "false");
      killWorker();
    }
  } else {
    localStorage.setItem("tracked_incidents", "[]");
    localStorage.setItem("location_tracking", "false");
    killWorker();
  }
};

const killWorker = () => {
  if (worker) {
    worker.postMessage('stop');
    worker.terminate();
    worker = null;
  }
  if (window.__sos_location_worker) {
    window.__sos_location_worker.terminate();
    window.__sos_location_worker = null;
  }
};
