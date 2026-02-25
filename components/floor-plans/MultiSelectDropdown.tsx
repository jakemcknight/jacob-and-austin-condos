import { useState, useRef, useEffect } from "react";

interface MultiSelectDropdownProps {
  options: string[];
  selected: string[];
  onChange: (vals: string[]) => void;
  allLabel: string;
  countLabel: string;
  formatOption?: (val: string) => string;
  widthClass?: string;
}

export default function MultiSelectDropdown({
  options,
  selected,
  onChange,
  allLabel,
  countLabel,
  formatOption,
  widthClass = "w-48",
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((v) => v !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const display = formatOption || ((v: string) => v);

  const label =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? display(selected[0])
        : `${selected.length} ${countLabel}`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded border bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent ${
          selected.length > 0 ? "border-accent" : "border-gray-300"
        }`}
      >
        {label}
        <svg
          className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute left-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg ${widthClass}`}
        >
          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="w-full border-b border-gray-100 px-3 py-1.5 text-left text-xs text-gray-500 hover:bg-gray-50"
            >
              Clear selection
            </button>
          )}
          {options.map((opt) => (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="rounded border-gray-300 text-accent focus:ring-accent"
              />
              {display(opt)}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
