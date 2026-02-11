"use client";

export default function QuickNav() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 80; // Header height offset
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: elementPosition - offset,
        behavior: "smooth",
      });
    }
  };

  const navItems = [
    { id: "about", label: "About" },
    { id: "amenities", label: "Amenities" },
    { id: "gallery", label: "Gallery" },
    { id: "floor-plans", label: "Floor Plans" },
    { id: "active-listings", label: "Active Listings" },
    { id: "nearby", label: "Nearby" },
    { id: "inquiry", label: "Contact" },
  ];

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="container-narrow">
        <div className="flex items-center justify-center gap-1 overflow-x-auto py-4 md:gap-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className="whitespace-nowrap px-3 py-2 text-xs font-medium uppercase tracking-wider text-secondary transition-colors hover:text-primary md:px-4 md:text-sm"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
