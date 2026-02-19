// Target keywords to monitor in the SEO dashboard
// These are tracked against GSC data to show ranking trends

import { buildings } from "./buildings";

// Core keywords
export const coreKeywords = [
  "downtown austin condos",
  "downtown austin condos for sale",
  "downtown austin condos for rent",
  "austin high rise condos",
  "luxury condos austin tx",
  "austin downtown condo",
  "condos for sale downtown austin",
  "high rise apartments downtown austin",
  "austin luxury high rise",
  "downtown austin real estate",
  "austin condo market",
  "best condos in downtown austin",
  "downtown austin condo prices",
  "austin condo investment",
  "condos near lady bird lake",
  "rainey street condos austin",
  "condos near congress avenue austin",
];

// Building-specific keywords (auto-generated from buildings data)
export const buildingKeywords = buildings.map((b) => ({
  keyword: `${b.name.toLowerCase()} austin`,
  building: b.slug,
}));

// All target keywords combined
export const allTargetKeywords = [
  ...coreKeywords,
  ...buildingKeywords.map((b) => b.keyword),
];
