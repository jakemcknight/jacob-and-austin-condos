import type { Metadata } from "next";
import CondoDirectory from "@/components/CondoDirectory";

export const metadata: Metadata = {
  title: "Downtown Austin Condos | 34+ High-Rise Buildings",
  description:
    "Explore 34+ downtown Austin high-rise condo buildings. Search by name, sort by floors or year built. Your comprehensive guide to luxury urban living in Austin, TX.",
  keywords: [
    "downtown austin condos",
    "austin high rise buildings",
    "luxury condos austin tx",
    "downtown austin real estate",
    "austin condo buildings",
  ],
  alternates: {
    canonical: "/downtown-condos",
  },
  openGraph: {
    title: "Downtown Austin Condos | Jacob In Austin",
    description:
      "Explore 34+ downtown Austin high-rise condo buildings. Search, filter, and find your next home in Austin's skyline.",
    type: "website",
    images: ["/images/og-default.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Downtown Austin Condos | Jacob In Austin",
    description:
      "Explore 34+ downtown Austin high-rise condo buildings. Your guide to luxury urban living.",
  },
};

export default function CondosPage() {
  return <CondoDirectory />;
}
