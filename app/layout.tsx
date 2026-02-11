import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Downtown Austin Condos | Jacob In Austin",
  description:
    "Explore downtown Austin's premier high-rise condos with Jacob Hannusch — your downtown high-rise expert. Browse buildings, amenities, and available units.",
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
