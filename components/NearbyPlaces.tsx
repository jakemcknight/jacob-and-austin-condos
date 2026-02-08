interface Place {
  name: string;
  address: string;
  distance: string;
}

interface NearbyPlacesProps {
  coffee: Place;
  restaurant: Place;
  bar: Place;
}

const categories = [
  { key: "coffee" as const, label: "Coffee", icon: "☕" },
  { key: "restaurant" as const, label: "Restaurant", icon: "🍽️" },
  { key: "bar" as const, label: "Bar", icon: "🍸" },
];

export default function NearbyPlaces({
  coffee,
  restaurant,
  bar,
}: NearbyPlacesProps) {
  const places = { coffee, restaurant, bar };

  return (
    <section className="section-padding">
      <div className="container-narrow max-w-4xl">
        <h2 className="mb-10 text-center text-sm font-semibold uppercase tracking-[0.3em] text-accent">
          Nearest To You
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {categories.map(({ key, label, icon }) => {
            const place = places[key];
            return (
              <div
                key={key}
                className="border border-gray-100 bg-white p-6 text-center"
              >
                <div className="text-3xl">{icon}</div>
                <p className="mt-3 text-xs uppercase tracking-[0.2em] text-accent">
                  Closest {label}
                </p>
                <p className="mt-3 text-base font-semibold text-primary">
                  {place.name}
                </p>
                <p className="mt-1 text-sm text-secondary">{place.address}</p>
                <p className="mt-2 text-xs text-accent">{place.distance}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
