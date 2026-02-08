"use client";

import Link from "next/link";
import { useState } from "react";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 z-50 w-full border-b border-gray-100 bg-white/95 backdrop-blur-sm">
      <div className="container-narrow flex items-center justify-between px-6 py-4 md:px-12 lg:px-20">
        <Link href="/" className="flex flex-col">
          <span className="text-xl font-bold uppercase tracking-widest text-primary">
            Jacob In Austin
          </span>
          <span className="text-[10px] uppercase tracking-[0.3em] text-accent">
            Downtown High-Rise Expert
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-8 md:flex">
          <Link
            href="/"
            className="text-sm uppercase tracking-wider text-secondary transition-colors hover:text-primary"
          >
            Condos
          </Link>
          <Link
            href="https://www.jacobinaustin.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm uppercase tracking-wider text-secondary transition-colors hover:text-primary"
          >
            About
          </Link>
          <Link
            href="#contact"
            className="border border-primary bg-primary px-5 py-2 text-sm uppercase tracking-wider text-white transition-colors hover:bg-white hover:text-primary"
          >
            Contact
          </Link>
        </nav>

        {/* Mobile Hamburger */}
        <button
          className="flex flex-col gap-1.5 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
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
        <nav className="border-t border-gray-100 bg-white px-6 py-6 md:hidden">
          <div className="flex flex-col gap-4">
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className="text-sm uppercase tracking-wider text-secondary"
            >
              Condos
            </Link>
            <Link
              href="https://www.jacobinaustin.com/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileOpen(false)}
              className="text-sm uppercase tracking-wider text-secondary"
            >
              About
            </Link>
            <Link
              href="#contact"
              onClick={() => setMobileOpen(false)}
              className="text-sm uppercase tracking-wider text-secondary"
            >
              Contact
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
