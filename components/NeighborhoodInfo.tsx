interface NeighborhoodInfoProps {
  neighborhood: string;
  address: string;
}

export default function NeighborhoodInfo({
  neighborhood,
  address,
}: NeighborhoodInfoProps) {
  return (
    <section className="section-padding">
      <div className="container-narrow max-w-3xl">
        <h2 className="mb-10 text-center text-sm font-semibold uppercase tracking-[0.3em] text-accent">
          Neighborhood
        </h2>
        <p className="text-center text-lg leading-relaxed text-secondary">
          {neighborhood}
        </p>
        <p className="mt-6 text-center text-sm text-accent">{address}</p>
      </div>
    </section>
  );
}
