"use client";

import BalconyViewer from "@/components/BalconyViewer";

export default function BalconyViewerPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative flex min-h-[40vh] items-center justify-center bg-primary">
        <div className="absolute inset-0 bg-gradient-to-br from-black to-gray-900" />
        <div className="relative z-10 px-6 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-gray-400">
            3D Balcony Views
          </p>
          <h1 className="mt-4 text-4xl font-bold uppercase tracking-widest text-white md:text-5xl">
            Experience The View
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-300">
            Explore photorealistic 3D views from balconies of 72+ downtown Austin
            buildings. Select a building, floor, and direction to see exactly what
            you&apos;d see from your future home.
          </p>
        </div>
      </section>

      {/* Instructions */}
      <section className="border-b border-gray-200 bg-white px-6 py-8">
        <div className="container-narrow mx-auto max-w-4xl">
          <div className="grid gap-6 text-center md:grid-cols-3">
            <div>
              <div className="mb-3 text-2xl font-bold text-primary">1</div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-accent">
                Select Building
              </h3>
              <p className="text-sm text-secondary">
                Choose from 72+ downtown Austin high-rises
              </p>
            </div>
            <div>
              <div className="mb-3 text-2xl font-bold text-primary">2</div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-accent">
                Choose Floor & Direction
              </h3>
              <p className="text-sm text-secondary">
                Select floor level (5-40) and compass direction
              </p>
            </div>
            <div>
              <div className="mb-3 text-2xl font-bold text-primary">3</div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-accent">
                Explore The View
              </h3>
              <p className="text-sm text-secondary">
                Navigate the 3D scene with your mouse or touch
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Viewer */}
      <section className="section-padding bg-light">
        <div className="container mx-auto px-6">
          <BalconyViewer height="700px" className="mx-auto max-w-7xl" />
        </div>
      </section>

      {/* Back Link */}
      <section className="border-t border-gray-100 bg-white px-6 py-8 text-center">
        <a
          href="/"
          className="text-sm uppercase tracking-wider text-accent transition-colors hover:text-primary"
        >
          ← Back to All Buildings
        </a>
      </section>
    </>
  );
}
