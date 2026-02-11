"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 z-50 w-full bg-[#E1DDD1]">
      <div className="flex items-center justify-between" style={{ padding: "1.3vw 4vw" }}>
        <a href="https://www.jacobinaustin.com/" className="flex items-center">
          <Image
            src="/downtown-condos/logo.webp"
            alt="Jacob Hannusch"
            width={200}
            height={50}
            className="w-auto h-[34px] md:h-[50px]"
            priority
          />
        </a>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="https://www.jacobinaustin.com/newsletter"
            className="text-base font-medium text-primary transition-colors hover:opacity-70"
          >
            Join Newsletter
          </a>
          <a
            href="https://www.jacobinaustin.com/insights"
            className="text-base font-medium text-primary transition-colors hover:opacity-70"
          >
            Insights
          </a>
          <Link
            href="/"
            className="text-base font-medium text-primary transition-colors hover:opacity-70"
          >
            Condos
          </Link>
          <a
            href="mailto:jacob@jacobinaustin.com"
            className="text-base font-medium text-primary transition-colors hover:opacity-70"
          >
            jacob@jacobinaustin.com
          </a>
        </nav>

        {/* Mobile Hamburger */}
        <button
          className="flex flex-col gap-1.5 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          style={{ padding: "6vw 0" }}
        >
          <span
            className={`h-0.5 w-6 bg-primary transition-transform ${mobileOpen ? "translate-y-2 rotate-45" : ""}`}
          />
          <span
            className={`h-0.5 w-6 bg-primary transition-opacity ${mobileOpen ? "opacity-0" : ""}`}
          />
          <span
            className={`h-0.5 w-6 bg-primary transition-transform ${mobileOpen ? "-translate-y-2 -rotate-45" : ""}`}
          />
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <nav className="border-t border-black/10 bg-[#E1DDD1] px-[6vw] py-6 md:hidden">
          <div className="flex flex-col gap-4">
            <a
              href="https://www.jacobinaustin.com/newsletter"
              onClick={() => setMobileOpen(false)}
              className="text-base font-medium text-primary"
            >
              Join Newsletter
            </a>
            <a
              href="https://www.jacobinaustin.com/insights"
              onClick={() => setMobileOpen(false)}
              className="text-base font-medium text-primary"
            >
              Insights
            </a>
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className="text-base font-medium text-primary"
            >
              Condos
            </Link>
            <a
              href="mailto:jacob@jacobinaustin.com"
              onClick={() => setMobileOpen(false)}
              className="text-base font-medium text-primary"
            >
              jacob@jacobinaustin.com
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}
