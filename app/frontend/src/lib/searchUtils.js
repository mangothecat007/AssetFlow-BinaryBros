/**
 * Advanced Search Utility for OneAlert
 * Supports:
 * - AND (+ or space): "android + dnsmasq" or "android dnsmasq"
 * - NOT (-): "android -linux" or "android - linux"
 * - OR (/): "android/iphone"
 */

export const matchesQuery = (itemString, query) => {
  if (!query || !query.trim()) return true;

  const searchable = itemString.toLowerCase();
  const q = query.toLowerCase();

  // 1. Handle OR groups first (lowest precedence)
  const orGroups = q.split('/').map(g => g.trim()).filter(Boolean);
  if (orGroups.length > 1) {
    return orGroups.some(group => matchesQuery(searchable, group));
  }

  // 2. Handle AND/NOT terms
  const tokens = q.split(/\s+/).filter(Boolean);
  const requirements = [];

  let currentMode = 'AND';

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === '+') {
      currentMode = 'AND';
      continue;
    }
    if (token === '-') {
      currentMode = 'NOT';
      continue;
    }

    if (token.startsWith('+')) {
      requirements.push({ term: token.slice(1), type: 'AND' });
    } else if (token.startsWith('-')) {
      requirements.push({ term: token.slice(1), type: 'NOT' });
    } else {
      requirements.push({ term: token, type: currentMode });
      // Reset mode to AND after a normal token unless an operator was explicitly provided before it
      currentMode = 'AND';
    }
  }

  for (const req of requirements) {
    if (!req.term) continue;
    const found = searchable.includes(req.term);
    if (req.type === 'AND' && !found) return false;
    if (req.type === 'NOT' && found) return false;
  }

  return true;
};
