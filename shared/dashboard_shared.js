// Aura Tier definitions and utilities

const DEFAULT_AURA_TIERS = [
  { id: 'bronze', name: 'Bronze', threshold: 0 },
  { id: 'silver', name: 'Silver', threshold: 50 },
  { id: 'gold', name: 'Gold', threshold: 100 },
  { id: 'platinum', name: 'Platinum', threshold: 200 }
];

/**
 * Computes a student's active tier based on their lifetime aura and any teacher-defined overrides.
 * @param {number} lifetimeAura 
 * @param {object} customClassSettings - settings object (e.g. { auraTiers: { silver: 60, gold: 120, platinum: 250 } })
 * @returns {object} The active tier object { id, name, threshold }
 */
function getStudentTier(lifetimeAura, customClassSettings) {
  const settingsTiers = (customClassSettings && customClassSettings.auraTiers) || {};
  
  // Build active tiers list using overrides if available
  const activeTiers = [
    { id: 'bronze', name: 'Bronze', threshold: typeof settingsTiers.bronze === 'number' ? settingsTiers.bronze : 0 },
    { id: 'silver', name: 'Silver', threshold: typeof settingsTiers.silver === 'number' ? settingsTiers.silver : 50 },
    { id: 'gold', name: 'Gold', threshold: typeof settingsTiers.gold === 'number' ? settingsTiers.gold : 100 },
    { id: 'platinum', name: 'Platinum', threshold: typeof settingsTiers.platinum === 'number' ? settingsTiers.platinum : 200 }
  ];

  // Sort tiers by threshold descending to find the highest met threshold
  activeTiers.sort((a, b) => b.threshold - a.threshold);

  // Find the first tier where student's lifetime aura meets or exceeds the threshold
  for (const tier of activeTiers) {
    if (lifetimeAura >= tier.threshold) {
      return tier;
    }
  }

  // Fallback (should be Bronze since it's 0)
  return activeTiers[activeTiers.length - 1];
}

// Export for Node/CommonJS environment if needed, or define on window object for browsers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEFAULT_AURA_TIERS,
    getStudentTier
  };
} else {
  window.DEFAULT_AURA_TIERS = DEFAULT_AURA_TIERS;
  window.getStudentTier = getStudentTier;
}
