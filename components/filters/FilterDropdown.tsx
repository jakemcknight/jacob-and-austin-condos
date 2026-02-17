"use client";

import { useState, useRef, useEffect } from "react";

interface FilterDropdownProps {
  label: string;
  activeLabel?: string;
  isActive: boolean;
  children: React.ReactNode;
  align?: "left" | "right";
  width?: string;
}

export default function FilterDropdown({
  label,
  activeLabel,
  isActive,
  children,
  align = "left",
  width = "w-72",
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
          isActive
            ? "border-accent bg-accent/10 text-accent"
            : "border-gray-300 bg-white text-primary hover:border-gray-400"
        }`}
      >
        <span className="whitespace-nowrap">{activeLabel || label}</span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute top-full z-30 mt-2 rounded-lg border border-gray-200 bg-white p-4 shadow-xl ${width} ${
            align === "right" ? "right-0" : "left-0"
          }`}
          style={{ maxWidth: "calc(100vw - 2rem)" }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
