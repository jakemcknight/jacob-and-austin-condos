import Link from "next/link";

interface BuildingCardProps {
  name: string;
  slug: string;
  address: string;
  floors: number;
  units: number;
  yearBuilt: number;
  priceRange: string;
  heroImage: string;
}

export default function BuildingCard({
  name,
  slug,
  address,
  floors,
  units,
  yearBuilt,
  priceRange,
}: BuildingCardProps) {
  return (
    <Link
      href={`/condos/${slug}`}
      className="group block overflow-hidden border border-gray-100 bg-white transition-all hover:border-gray-300 hover:shadow-lg"
    >
      {/* Image Placeholder */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        <div className="flex h-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 transition-transform duration-500 group-hover:scale-105">
          <div className="text-center">
            <div className="text-4xl">🏙️</div>
            <p className="mt-2 text-xs uppercase tracking-wider text-accent">
              {name}
            </p>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-5">
        <h3 className="text-lg font-semibold uppercase tracking-wide text-primary">
          {name}
        </h3>
        <p className="mt-1 text-sm text-accent">{address}</p>
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
          <div className="text-xs text-accent">
            <span className="font-medium text-secondary">{floors}</span> Floors
            {" · "}
            <span className="font-medium text-secondary">{units}</span> Units
            {" · "}
            <span className="font-medium text-secondary">{yearBuilt}</span>
          </div>
        </div>
        <p className="mt-2 text-sm font-medium text-primary">{priceRange}</p>
      </div>
    </Link>
  );
}
