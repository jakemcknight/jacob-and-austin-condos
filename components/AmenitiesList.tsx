interface AmenitiesListProps {
  amenities: string[];
}

const amenityIcons: Record<string, string> = {
  pool: "🏊",
  "swimming pool": "🏊",
  "rooftop pool": "🏊",
  "infinity pool": "🏊",
  "fitness center": "💪",
  gym: "💪",
  "fitness room": "💪",
  concierge: "🛎️",
  "24-hour concierge": "🛎️",
  "valet parking": "🚗",
  valet: "🚗",
  parking: "🚗",
  "covered parking": "🚗",
  "rooftop deck": "🌇",
  "rooftop terrace": "🌇",
  "rooftop lounge": "🌇",
  "sky lounge": "🌇",
  spa: "🧖",
  "dog park": "🐕",
  "pet friendly": "🐕",
  "pet park": "🐕",
  "business center": "💼",
  "conference room": "💼",
  "wine room": "🍷",
  "wine cellar": "🍷",
  "theater room": "🎬",
  "screening room": "🎬",
  "movie theater": "🎬",
  "game room": "🎮",
  lounge: "🛋️",
  "resident lounge": "🛋️",
  "club room": "🛋️",
  "outdoor kitchen": "🍳",
  "grilling area": "🍳",
  "bbq area": "🍳",
  "fire pit": "🔥",
  "yoga studio": "🧘",
  sauna: "♨️",
  "steam room": "♨️",
  "bike storage": "🚲",
  "package lockers": "📦",
  "ev charging": "⚡",
  "electric vehicle charging": "⚡",
  doorman: "🚪",
  "guest suites": "🛏️",
  "guest suite": "🛏️",
  "putting green": "⛳",
  "tennis court": "🎾",
  "pickleball court": "🎾",
};

function getIcon(amenity: string): string {
  const lower = amenity.toLowerCase();
  for (const [key, icon] of Object.entries(amenityIcons)) {
    if (lower.includes(key)) return icon;
  }
  return "✦";
}

export default function AmenitiesList({ amenities }: AmenitiesListProps) {
  return (
    <section className="section-padding">
      <div className="container-narrow">
        <h2 className="mb-10 text-center text-sm font-semibold uppercase tracking-[0.3em] text-accent">
          Amenities
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {amenities.map((amenity) => (
            <div
              key={amenity}
              className="flex items-center gap-3 rounded-sm border border-gray-100 bg-white px-4 py-3"
            >
              <span className="text-xl">{getIcon(amenity)}</span>
              <span className="text-sm text-secondary">{amenity}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
