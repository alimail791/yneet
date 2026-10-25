// Student plan prices by class tier (rupees). Single source of truth for the
// pricing page (GET /subscription/plans) and checkout.
//
//   Class 6–8   → free tier: Daily Quiz, Shorts and daily puzzles, no payment
//   Class 9–10  → NEET Foundation
//   Class 11–12 → NEET Full
//   Dropper     → NEET Full (Dropper)
//
// 6 months ≈ 5 months' price, 12 months ≈ 8 months' price. Any other length is
// monthly × months, capped so it's never more than the next bundle up.
const TIERS = {
  junior:     { key: "junior",     label: "Free for Class 6–8", free: true },
  foundation: { key: "foundation", label: "NEET Foundation", monthly: 299, six: 1499, year: 2399 },
  neet:       { key: "neet",       label: "NEET Full",       monthly: 399, six: 1999, year: 3199 },
  dropper:    { key: "dropper",    label: "NEET Full · Dropper", monthly: 499, six: 2499, year: 3999 },
};

const CLASS_TIER = {
  "6th": "junior", "7th": "junior", "8th": "junior",
  "9th": "foundation", "10th": "foundation",
  "11th": "neet", "12th": "neet",
  Dropper: "dropper",
};

const MAX_MONTHS = 12;
const tierFor = (classLevel) => TIERS[CLASS_TIER[classLevel] || "neet"]; // unknown class → NEET Full
const isJuniorClass = (classLevel) => CLASS_TIER[classLevel] === "junior";

// Price in rupees for `months` months of a paid tier.
function priceRupees(tier, months) {
  if (tier.free) return 0;
  const n = Math.min(MAX_MONTHS, Math.max(1, months | 0));
  if (n >= 12) return tier.year;
  if (n >= 6) return Math.min(tier.six + (n - 6) * tier.monthly, tier.year);
  return Math.min(n * tier.monthly, tier.six);
}

// Full 1..12 table for the pricing page, so the client never re-implements the rule.
function priceTable(tier) {
  if (tier.free) return [];
  return Array.from({ length: MAX_MONTHS }, (_, i) => {
    const months = i + 1;
    const price = priceRupees(tier, months);
    return { months, price, saving: Math.max(0, months * tier.monthly - price) };
  });
}

module.exports = { TIERS, CLASS_TIER, MAX_MONTHS, tierFor, isJuniorClass, priceRupees, priceTable };
