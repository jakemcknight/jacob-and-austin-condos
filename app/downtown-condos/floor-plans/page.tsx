import type { Metadata } from "next";
import { parseFloorPlanCSV } from "@/lib/agent-floor-plans/parse-csv";
import AgentPortal from "@/components/floor-plans/AgentPortal";

export const metadata: Metadata = {
  title: "Floor Plan Portal | Jacob In Austin",
  robots: { index: false, follow: false },
};

export default function FloorPlansPage() {
  const allPlans = parseFloorPlanCSV();

  return <AgentPortal allPlans={allPlans} />;
}
