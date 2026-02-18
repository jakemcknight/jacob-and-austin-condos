"use client";

import { useState, useCallback, useRef } from "react";

const MAX_RETRIES = 2;
const RETRY_DELAYS = [2000, 4000]; // ms

/**
 * Hook that provides retry logic for images that may fail due to transient CDN errors.
 * On error, retries up to 2 times with exponential backoff and a cache-bust param.
 * Returns the current src to use and an onError handler.
 */
export function useRetryImage(baseSrc: string) {
  const [failed, setFailed] = useState(false);
  const retryCount = useRef(0);
  const [src, setSrc] = useState(baseSrc);

  const onError = useCallback(() => {
    if (retryCount.current < MAX_RETRIES) {
      const delay = RETRY_DELAYS[retryCount.current];
      retryCount.current += 1;
      setTimeout(() => {
        // Append cache-bust param to bypass Vercel edge cache of the 404
        const bust = `_r=${Date.now()}`;
        const separator = baseSrc.includes("?") ? "&" : "?";
        setSrc(`${baseSrc}${separator}${bust}`);
      }, delay);
    } else {
      setFailed(true);
    }
  }, [baseSrc]);

  return { src, failed, onError };
}

/**
 * Hook for tracking retry state across multiple images (e.g., a gallery).
 * Each image index is tracked independently.
 */
export function useRetryImages(baseUrls: (index: number) => string) {
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const [srcs, setSrcs] = useState<Record<number, string>>({});
  const retryCounts = useRef<Record<number, number>>({});

  const getSrc = useCallback(
    (index: number) => srcs[index] || baseUrls(index),
    [srcs, baseUrls]
  );

  const onError = useCallback(
    (index: number) => {
      const count = retryCounts.current[index] || 0;
      if (count < MAX_RETRIES) {
        const delay = RETRY_DELAYS[count];
        retryCounts.current[index] = count + 1;
        setTimeout(() => {
          const base = baseUrls(index);
          const bust = `_r=${Date.now()}`;
          const separator = base.includes("?") ? "&" : "?";
          setSrcs((prev) => ({ ...prev, [index]: `${base}${separator}${bust}` }));
        }, delay);
      } else {
        setFailed((prev) => ({ ...prev, [index]: true }));
      }
    },
    [baseUrls]
  );

  return { getSrc, failed, onError };
}
