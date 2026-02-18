import Link from "next/link";

export default function NotFound() {
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-xs uppercase tracking-[0.4em] text-accent">
        Page Not Found
      </p>
      <h1 className="mt-4 text-5xl font-bold uppercase tracking-widest text-primary">
        404
      </h1>
      <p className="mt-6 max-w-md text-lg text-secondary">
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link
          href="/"
          className="border border-primary px-8 py-3 text-sm uppercase tracking-widest text-primary transition-colors hover:bg-primary hover:text-white"
        >
          All Buildings
        </Link>
        <Link
          href="/for-sale"
          className="border border-primary bg-primary px-8 py-3 text-sm uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-primary"
        >
          Browse Listings
        </Link>
      </div>
    </section>
  );
}
