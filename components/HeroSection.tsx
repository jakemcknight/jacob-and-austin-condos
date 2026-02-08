interface HeroSectionProps {
  title: string;
  subtitle?: string;
  backgroundImage?: string;
}

export default function HeroSection({
  title,
  subtitle,
  backgroundImage,
}: HeroSectionProps) {
  return (
    <section className="relative flex min-h-[50vh] items-center justify-center bg-primary">
      {backgroundImage && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      <div className="relative z-10 px-6 text-center">
        <h1 className="text-4xl font-bold uppercase tracking-widest text-white md:text-5xl lg:text-6xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-300 md:text-xl">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
