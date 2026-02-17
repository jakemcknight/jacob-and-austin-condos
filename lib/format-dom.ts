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
