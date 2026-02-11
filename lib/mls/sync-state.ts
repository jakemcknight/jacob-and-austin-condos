// Sync state management for MLSGrid replication
// Tracks last sync timestamp for incremental updates

import fs from "fs";
import path from "path";

const STATE_DIR = path.join(process.cwd(), "data", "mls-sync-state");
const STATE_FILE = path.join(STATE_DIR, "sync-state.json");

export interface SyncState {
  lastSyncTimestamp: string; // ISO 8601 format
  lastSyncDate: string; // Human-readable
  salesCount: number;
  leasesCount: number;
  totalCount: number;
  status: "success" | "error" | "in_progress";
  errorMessage?: string;
}

/**
 * Ensure state directory exists
 */
function ensureStateDir(): void {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
}

/**
 * Read current sync state
 */
export async function readSyncState(): Promise<SyncState | null> {
  try {
    ensureStateDir();

    if (!fs.existsSync(STATE_FILE)) {
      return null;
    }

    const content = fs.readFileSync(STATE_FILE, "utf-8");
    const state: SyncState = JSON.parse(content);

    return state;
  } catch (error) {
    console.error("[Sync State] Error reading state:", error);
    return null;
  }
}

/**
 * Write sync state
 */
export async function writeSyncState(state: SyncState): Promise<void> {
  try {
    ensureStateDir();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
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
  salesCount: number,
  leasesCount: number,
  latestTimestamp: string
): Promise<void> {
  const state: SyncState = {
    lastSyncTimestamp: latestTimestamp,
    lastSyncDate: new Date(latestTimestamp).toLocaleString(),
    salesCount,
    leasesCount,
    totalCount: salesCount + leasesCount,
    status: "success",
  };

  await writeSyncState(state);
}

/**
 * Mark sync as in progress
 */
export async function markSyncInProgress(): Promise<void> {
  const currentState = await readSyncState();

  const state: SyncState = {
    lastSyncTimestamp: currentState?.lastSyncTimestamp || new Date().toISOString(),
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
 */
export async function markSyncFailed(errorMessage: string): Promise<void> {
  const currentState = await readSyncState();

  const state: SyncState = {
    lastSyncTimestamp: currentState?.lastSyncTimestamp || new Date().toISOString(),
    lastSyncDate: new Date().toLocaleString(),
    salesCount: currentState?.salesCount || 0,
    leasesCount: currentState?.leasesCount || 0,
    totalCount: currentState?.totalCount || 0,
    status: "error",
    errorMessage,
  };

  await writeSyncState(state);
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
