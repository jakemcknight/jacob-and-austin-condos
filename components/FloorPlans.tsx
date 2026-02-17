"use client";

import { useState, useMemo } from "react";
import type { FloorPlan } from "@/data/floorPlans";

interface FloorPlansProps {
  buildingName: string;
  buildingSlug: string;
  floorPlans?: FloorPlan[];
}

function groupHeading(bed: number): string {
  if (bed === 0) return "Studio Floor Plans";
  if (bed === 1) return "One Bedroom Floor Plans";
  if (bed === 2) return "Two Bedroom Floor Plans";
  if (bed === 3) return "Three Bedroom Floor Plans";
  return `${bed} Bedroom Floor Plans`;
}

function formatSqft(sqft: number): string {
  if (sqft <= 0) return "—";
  return sqft.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export default function FloorPlans({
  buildingName,
  buildingSlug,
  floorPlans,
}: FloorPlansProps) {
  const [selectedPlan, setSelectedPlan] = useState<FloorPlan | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState(false);

  const handleShare = async (plan: FloorPlan) => {
    const url = `${window.location.origin}/downtown-condos/${buildingSlug}/${plan.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that don't support clipboard API
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Group floor plans by bedroom count
  const bedroomGroups = useMemo(() => {
    if (!floorPlans || floorPlans.length === 0) return {};
    const groups: Record<number, FloorPlan[]> = {};
    for (const plan of floorPlans) {
      if (!groups[plan.bedrooms]) groups[plan.bedrooms] = [];
      groups[plan.bedrooms].push(plan);
    }
    return groups;
  }, [floorPlans]);

  const bedroomCounts = Object.keys(bedroomGroups)
    .map(Number)
    .sort((a, b) => a - b);

  const toggleGroup = (bedrooms: number) => {
    setExpandedGroups(prev => ({
      ...prev,
      [bedrooms]: !prev[bedrooms]
    }));
  };

  // No floor plan data — show placeholder
  if (!floorPlans || floorPlans.length === 0) {
    return (
      <section id="floor-plans" className="section-padding bg-light">
        <div className="container-narrow max-w-3xl text-center">
          <h2 className="mb-10 text-sm font-semibold uppercase tracking-[0.3em] text-accent">
            Floor Plans
          </h2>
          <div className="border border-gray-200 bg-white p-12">
            <div className="text-4xl">📐</div>
            <p className="mt-4 text-lg font-semibold text-primary">
              {buildingName} Floor Plans
            </p>
            <p className="mt-2 text-sm text-secondary">
              Contact Jacob for detailed floor plans, availability, and pricing
              for {buildingName}.
            </p>
            <a
              href="#inquiry"
              className="mt-6 inline-block border border-primary bg-primary px-8 py-3 text-sm uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-primary"
            >
              Request Floor Plans
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="floor-plans" className="section-padding bg-white">
      <div className="container-narrow">
        {/* Heading */}
        <h2 className="mb-10 text-center text-2xl tracking-tight text-primary md:text-3xl">
          <span className="font-bold">Floor Plans</span>{" "}
          <span className="font-light">at {buildingName}</span>
        </h2>

        {/* Grouped Tables */}
        <div className="grid items-start gap-8 md:grid-cols-2 lg:grid-cols-3">
          {bedroomCounts.map((bed) => {
            const plans = bedroomGroups[bed];
            const isExpanded = expandedGroups[bed] || false;
            const hasMore = plans.length > 4;
            const visiblePlans = hasMore && !isExpanded ? plans.slice(0, 4) : plans;

            return (
              <div key={bed} className="border border-gray-200 bg-white p-6">
                <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-primary">
                  {groupHeading(bed)}
                </h3>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase tracking-wider text-accent">
                      <th className="pb-2 pr-3 font-normal">Floor Plan</th>
                      <th className="pb-2 pr-3 font-normal"># Bed</th>
                      <th className="pb-2 pr-3 font-normal"># Bath</th>
                      <th className="pb-2 font-normal text-right">
                        SQ FT (Int.)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePlans.map((plan) => (
                      <tr
                        key={plan.name}
                        className="border-b border-gray-100 last:border-0"
                      >
                        <td className="py-2.5 pr-3">
                          <button
                            onClick={() => setSelectedPlan(plan)}
                            className="font-semibold text-primary underline decoration-gray-300 underline-offset-2 hover:decoration-primary"
                          >
                            {plan.name}
                          </button>
                        </td>
                        <td className="py-2.5 pr-3 text-secondary">{bed}</td>
                        <td className="py-2.5 pr-3 text-secondary">
                          {plan.bathrooms}
                        </td>
                        <td className="py-2.5 text-right text-secondary">
                          {formatSqft(plan.sqft)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {hasMore && (
                  <button
                    onClick={() => toggleGroup(bed)}
                    className="mt-4 w-full border border-gray-300 py-2 text-xs font-medium uppercase tracking-wider text-secondary transition-colors hover:border-primary hover:text-primary"
                  >
                    {isExpanded ? `Show Less` : `Show More (${plans.length - 4} more)`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Modal */}
        {selectedPlan && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setSelectedPlan(null)}
          >
            <div
              className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto bg-white"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedPlan(null)}
                className="absolute right-4 top-4 z-10 text-2xl leading-none text-gray-400 hover:text-primary"
              >
                &times;
              </button>

              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-100 p-6 pr-12">
                <div>
                  <p className="text-xl font-semibold text-primary">
                    {selectedPlan.name}
                  </p>
                  <p className="mt-1 text-sm text-secondary">
                    {selectedPlan.bedrooms === 0
                      ? "Studio"
                      : `${selectedPlan.bedrooms} Bed`}{" "}
                    / {selectedPlan.bathrooms} Bath
                    {selectedPlan.hasStudy && " + Study"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-semibold text-primary">
                    {formatSqft(selectedPlan.sqft)} SF
                  </p>
                </div>
              </div>

              {/* Floor Plan Image */}
              {selectedPlan.imageUrl && (
                <div className="bg-gray-50 p-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/downtown-condos${selectedPlan.imageUrl}`}
                    alt={`${buildingName} - ${selectedPlan.name} floor plan`}
                    className="mx-auto max-h-[50vh] w-auto cursor-pointer"
                    onClick={() => setIsFullScreen(true)}
                  />
                </div>
              )}

              {/* Actions */}
              <div className="border-t border-gray-100 p-6 space-y-3">
                {/* View Full Screen */}
                {selectedPlan.imageUrl && (
                  <button
                    onClick={() => setIsFullScreen(true)}
                    className="block w-full border border-blue-600 bg-blue-600 py-3 text-center text-xs uppercase tracking-wider text-white transition-colors hover:bg-blue-700 hover:border-blue-700"
                  >
                    View Full Screen
                  </button>
                )}

                {/* Share */}
                <button
                  onClick={() => handleShare(selectedPlan)}
                  className="block w-full border border-gray-300 bg-white py-3 text-center text-xs uppercase tracking-wider text-secondary transition-colors hover:border-primary hover:text-primary"
                >
                  {copied ? "Link Copied!" : "Share Floor Plan"}
                </button>

                {/* Inquire */}
                <a
                  href="#inquiry"
                  onClick={() => setSelectedPlan(null)}
                  className="block border border-primary bg-white py-3 text-center text-xs uppercase tracking-wider text-primary transition-colors hover:bg-primary hover:text-white"
                >
                  Inquire About This Plan
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Full Screen Image Overlay */}
        {isFullScreen && selectedPlan?.imageUrl && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4"
            onClick={() => setIsFullScreen(false)}
          >
            <button
              onClick={() => setIsFullScreen(false)}
              className="absolute right-4 top-4 z-10 text-4xl leading-none text-white hover:text-gray-300"
            >
              &times;
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/downtown-condos${selectedPlan.imageUrl}`}
              alt={`${buildingName} - ${selectedPlan.name} floor plan`}
              className="max-h-[95vh] max-w-[95vw] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    </section>
  );
}
