import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Downtown Austin Condos | Jacob In Austin",
  description:
    "Explore downtown Austin's premier high-rise condos with Jacob Hannusch — your downtown high-rise expert. Browse buildings, amenities, and available units.",
  metadataBase: new URL("https://jacobinaustin.com/downtown-condos"),
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main className="min-h-screen pt-[76px]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
