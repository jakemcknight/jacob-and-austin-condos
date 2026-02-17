// Sync state management for MLSGrid replication
// Tracks last sync timestamp for incremental updates
// Uses Vercel KV for persistent storage in serverless environment

import { kv } from "@vercel/kv";
import { unstable_noStore as noStore } from "next/cache";

const SYNC_STATE_KEY = "mls:sync:state";

export interface SyncState {
  lastSyncTimestamp: string; // ISO 8601 format
  lastSyncDate: string; // Human-readable
  salesCount: number; // Total in cache
  leasesCount: number; // Total in cache
  totalCount: number; // Total in cache
  batchSalesCount?: number; // From last sync batch
  batchLeasesCount?: number; // From last sync batch
  batchTotalCount?: number; // From last sync batch
  status: "success" | "error" | "in_progress";
  errorMessage?: string;
}

/**
 * Read current sync state from Vercel KV
 */
export async function readSyncState(): Promise<SyncState | null> {
  noStore();
  try {
    const state = await kv.get<SyncState>(SYNC_STATE_KEY);
    return state;
  } catch (error) {
    console.error("[Sync State] Error reading state:", error);
    return null;
  }
}

/**
 * Write sync state to Vercel KV
 */
export async function writeSyncState(state: SyncState): Promise<void> {
  try {
    await kv.set(SYNC_STATE_KEY, state);
    console.log(`[Sync State] Updated state: ${state.totalCount} listings at ${state.lastSyncDate}`);
  } catch (error) {
    console.error("[Sync State] Error writing state:", error);
    throw error;
  }
}

/**
 * Get the last sync timestamp for incremental syncs
 * Returns null if no previous sync exists
 */
export async function getLastSyncTimestamp(): Promise<string | null> {
  const state = await readSyncState();
  return state?.lastSyncTimestamp || null;
}

/**
 * Update sync state after successful replication
 */
export async function updateSyncState(
  totalSalesCount: number,
  totalLeasesCount: number,
  latestTimestamp: string,
  batchSalesCount?: number,
  batchLeasesCount?: number
): Promise<void> {
  const state: SyncState = {
    lastSyncTimestamp: latestTimestamp,
    lastSyncDate: new Date(latestTimestamp).toLocaleString(),
    salesCount: totalSalesCount,
    leasesCount: totalLeasesCount,
    totalCount: totalSalesCount + totalLeasesCount,
    batchSalesCount,
    batchLeasesCount,
    batchTotalCount: batchSalesCount !== undefined && batchLeasesCount !== undefined
      ? batchSalesCount + batchLeasesCount
      : undefined,
    status: "success",
  };

  await writeSyncState(state);
}

/**
 * Check if a sync is currently in progress
 * Returns true if another sync is running (prevents overlapping syncs)
 */
export async function isSyncInProgress(): Promise<boolean> {
  const state = await readSyncState();

  // If status is "in_progress", check if it's stale (older than 10 minutes)
  if (state?.status === "in_progress") {
    const lastSyncTime = new Date(state.lastSyncDate).getTime();
    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000;

    // If the "in_progress" status is older than 10 minutes, consider it stale
    if (now - lastSyncTime > tenMinutes) {
      console.warn("[Sync State] Stale 'in_progress' status detected, allowing new sync");
      return false;
    }

    return true;
  }

  return false;
}

/**
 * Mark sync as in progress
 * If no previous state exists, creates a temporary state without a real lastSyncTimestamp
 * so that a failed initial import won't accidentally trap the system in incremental mode
 */
export async function markSyncInProgress(): Promise<void> {
  const currentState = await readSyncState();

  const state: SyncState = {
    lastSyncTimestamp: currentState?.lastSyncTimestamp || "",
    lastSyncDate: new Date().toLocaleString(),
    salesCount: currentState?.salesCount || 0,
    leasesCount: currentState?.leasesCount || 0,
    totalCount: currentState?.totalCount || 0,
    status: "in_progress",
  };

  await writeSyncState(state);
}

/**
 * Mark sync as failed with error message
 * If no previous sync state exists (e.g., after a reset), does NOT create a new timestamp
 * so the next sync will still be treated as an initial import
 */
export async function markSyncFailed(errorMessage: string): Promise<void> {
  const currentState = await readSyncState();

  // If there's no existing state, don't create one — this keeps the system in
  // "initial import" mode so the next sync will retry from scratch
  if (!currentState) {
    console.warn(`[Sync State] No existing state to mark as failed (initial import will be retried): ${errorMessage}`);
    return;
  }

  const state: SyncState = {
    lastSyncTimestamp: currentState.lastSyncTimestamp,
    lastSyncDate: new Date().toLocaleString(),
    salesCount: currentState.salesCount || 0,
    leasesCount: currentState.leasesCount || 0,
    totalCount: currentState.totalCount || 0,
    status: "error",
    errorMessage,
  };

  await writeSyncState(state);
}

/**
 * Reset sync state - forces the next sync to be an initial import
 * Use this when the cache has been cleared or data needs to be fully repopulated
 */
export async function resetSyncState(): Promise<void> {
  try {
    await kv.del(SYNC_STATE_KEY);
    console.log("[Sync State] Reset sync state - next sync will be initial import");
  } catch (error) {
    console.error("[Sync State] Error resetting state:", error);
    throw error;
  }
}

/**
 * Find the latest ModificationTimestamp from a list of listings
 */
export function findLatestTimestamp(listings: Array<{ modificationTimestamp?: string }>): string {
  let latest = new Date(0).toISOString(); // Start with epoch

  for (const listing of listings) {
    if (listing.modificationTimestamp && listing.modificationTimestamp > latest) {
      latest = listing.modificationTimestamp;
    }
  }

  return latest;
}
