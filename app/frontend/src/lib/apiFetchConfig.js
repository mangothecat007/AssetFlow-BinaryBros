// Global API fetch interval configuration
const DEFAULT_INTERVALS = {
  global: 5000, // 5 seconds (default for all)
  home: 5000, // HomeView
  security: 5000, // SecurityView
  analytics: 5000, // AnalyticsView
  explorer: 5000, // ExplorerView
};

export const getEffectiveInterval = (activeTab) => {
  // For operations and home tabs, use the global interval
  if (activeTab === "operations" || activeTab === "home") {
    return Math.max(1500, DEFAULT_INTERVALS.global);
  }

  // For other tabs, use their specific interval or global as fallback
  const interval = DEFAULT_INTERVALS[activeTab] || DEFAULT_INTERVALS.global;
  return Math.max(1500, interval);
};


export const DEFAULT_INTERVALS_EXPORT = DEFAULT_INTERVALS;
