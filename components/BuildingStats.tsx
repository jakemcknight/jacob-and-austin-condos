interface BuildingStatsProps {
  address: string;
  floors: number;
  units: number;
  yearBuilt: number;
  architect: string;
  developer: string;
}

export default function BuildingStats({
  address,
  floors,
  units,
  yearBuilt,
  architect,
  developer,
}: BuildingStatsProps) {
  const stats = [
    { label: "Address", value: address },
    { label: "Floors", value: floors.toString() },
    { label: "Residences", value: units.toString() },
    { label: "Year Built", value: yearBuilt.toString() },
    { label: "Architect", value: architect },
    { label: "Developer", value: developer },
  ];

  return (
    <section className="section-padding bg-light">
      <div className="container-narrow">
        <h2 className="mb-10 text-center text-sm font-semibold uppercase tracking-[0.3em] text-accent">
          Quick Facts
        </h2>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-xs uppercase tracking-wider text-accent">
                {stat.label}
              </p>
              <p className="mt-1 text-lg font-semibold text-primary">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
