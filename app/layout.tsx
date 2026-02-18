import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Downtown Austin Condos | Jacob In Austin",
  description:
    "Explore downtown Austin's premier high-rise condos with Jacob Hannusch — your downtown high-rise expert. Browse buildings, amenities, and available units.",
  metadataBase: new URL("https://jacobinaustin.com/downtown-condos"),
  alternates: {
    canonical: "/",
  },
  verification: {
    google: "cXQTHnRF6av0_gyKI__2zk0HDw9iAsHDeeLOlERa7P8",
  },
  openGraph: {
    title: "Downtown Austin Condos | Jacob In Austin",
    description:
      "Explore downtown Austin's premier high-rise condos with Jacob Hannusch — your downtown high-rise expert.",
    type: "website",
    images: [
      {
        url: "/images/og-default.jpg",
        width: 1280,
        height: 720,
        alt: "Downtown Austin skyline from Town Lake",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/images/og-default.jpg"],
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "RealEstateAgent",
  name: "Jacob Hannusch",
  alternateName: "Jacob In Austin",
  url: "https://jacobinaustin.com",
  telephone: "+15127181600",
  email: "jacob@jacobinaustin.com",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Austin",
    addressRegion: "TX",
    addressCountry: "US",
  },
  sameAs: [
    "https://www.facebook.com/share/g/17SBHvfAS6/",
    "https://www.linkedin.com/in/jacob-hannusch/",
    "https://www.instagram.com/jacobinaustin_",
  ],
  areaServed: {
    "@type": "City",
    name: "Austin",
    containedIn: {
      "@type": "State",
      name: "Texas",
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        <Header />
        <main className="min-h-screen pt-[76px]">{children}</main>
        <Footer />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
