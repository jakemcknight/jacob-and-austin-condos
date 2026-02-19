import type { Metadata } from "next";
import SEODashboard from "@/components/seo/SEODashboard";

export const metadata: Metadata = {
  title: "SEO Dashboard | Jacob In Austin",
  robots: { index: false, follow: false },
};

export default function SEODashboardPage() {
  return <SEODashboard />;
}
