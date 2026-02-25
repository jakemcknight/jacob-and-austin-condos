export interface AgentFloorPlan {
  building: string;
  buildingSlug: string;
  floorPlan: string;
  floorPlanSlug: string;
  bedrooms: number;
  bathrooms: number;
  hasStudy: boolean;
  sqft: number;
  orientation: string;
  unitNumbers: string;
  quantity: number;
  websiteUrl: string;
}

export type ColumnKey =
  | "floorPlan"
  | "bedrooms"
  | "bathrooms"
  | "hasStudy"
  | "sqft"
  | "orientation"
  | "unitNumbers"
  | "quantity";

export interface Filters {
  building: string;
  bedrooms: string;
  orientation: string;
  study: string;
  minSqft: string;
  maxSqft: string;
}
