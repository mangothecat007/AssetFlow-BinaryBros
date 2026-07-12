export const parseCommand = (text, commands) => {
  const normalized = text.toLowerCase().trim();
  const sorted = [...commands]
    .filter(c => c.phrase) // Filter out any commands with missing phrases (typos)
    .sort((a, b) => b.phrase.length - a.phrase.length);

  for (const cmd of sorted) {
    if (normalized.includes(cmd.phrase.toLowerCase())) {
      return cmd;
    }
  }
  return { action: "unknown", original: text };
};
