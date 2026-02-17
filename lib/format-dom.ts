/**
 * Calculate days on market from the listing's list date.
 *
 * The MLSGrid API's DaysOnMarket field is unreliable — ACTRIS MLS resets it
 * on status changes, so a month-old listing can show "1 day". We calculate
 * DOM ourselves from listDate (like Zillow/Redfin) for accuracy.
 */
export function calculateDaysOnMarket(listDate: string): number {
  if (!listDate) return 0;
  const listed = new Date(listDate + "T00:00:00");
  const now = new Date();
  const diffMs = now.getTime() - listed.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

/**
 * Format days-on-market count for user-friendly badge display.
 * 0 → "New"
 * 1 → "1 Day on Market"
 * N → "N Days on Market"
 */
export function formatDaysOnMarket(days: number): string {
  if (days === 0) return "New";
  if (days === 1) return "1 Day on Market";
  return `${days} Days on Market`;
}

/**
 * Format orientation abbreviation to human-readable label.
 *
 * Abbreviation patterns from unit lookup CSV:
 *   Single: N, S, E, W
 *   Combo:  SE, SW
 *   Corner (suffix "c"): NEc → Northeast Corner, NWc → Northwest Corner, etc.
 *   Multi-direction corner: NESc → North-East-South Corner, SEWc → South-East-West Corner
 *   Special: "S, N" → "South, North"
 */
const DIRECTION_MAP: Record<string, string> = {
  N: "North",
  S: "South",
  E: "East",
  W: "West",
};

export function formatOrientation(abbr: string): string {
  if (!abbr) return "";

  // Handle comma-separated (e.g. "S, N")
  if (abbr.includes(",")) {
    return abbr
      .split(",")
      .map((s) => formatOrientation(s.trim()))
      .join(", ");
  }

  const isCorner = abbr.endsWith("c");
  const dirs = isCorner ? abbr.slice(0, -1) : abbr;

  // Expand each capital letter to its full direction name
  const expanded = dirs
    .split("")
    .map((ch) => DIRECTION_MAP[ch] || ch)
    .join("-");

  return isCorner ? `${expanded} Corner` : expanded;
}
