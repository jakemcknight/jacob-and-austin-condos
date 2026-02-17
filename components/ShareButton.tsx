"use client";

import { useState } from "react";

interface ShareButtonProps {
  url?: string;
  title?: string;
  text?: string;
  pageType: string;
  listingId?: string;
  buildingSlug?: string;
}

export default function ShareButton({
  url,
  title,
  text,
  pageType,
  listingId,
  buildingSlug,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const shareUrl = url || window.location.href;
    const shareData = { title, text, url: shareUrl };
    let method = "unknown";

    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        method = "native";
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        method = "clipboard";
      }

      // Fire-and-forget tracking
      fetch("/downtown-condos/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: shareUrl,
          pageType,
          listingId,
          buildingSlug,
          method,
        }),
      }).catch(() => {});
    } catch (err) {
      // User cancelled native share dialog
      if ((err as Error).name !== "AbortError") {
        // Fallback to clipboard if share API failed
        try {
          await navigator.clipboard.writeText(shareUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          method = "clipboard";

          fetch("/downtown-condos/api/shares", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: shareUrl,
              pageType,
              listingId,
              buildingSlug,
              method,
            }),
          }).catch(() => {});
        } catch {
          console.error("[ShareButton] Share failed");
        }
      }
    }
  }

  return (
    <button
      onClick={handleShare}
      className="flex w-full items-center justify-center gap-2 rounded border border-gray-200 bg-white py-3 text-sm font-semibold uppercase tracking-widest text-primary transition-colors hover:bg-gray-50"
    >
      {copied ? (
        <>
          {/* Checkmark icon */}
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Link Copied!
        </>
      ) : (
        <>
          {/* Share icon */}
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
          </svg>
          Share Listing
        </>
      )}
    </button>
  );
}
