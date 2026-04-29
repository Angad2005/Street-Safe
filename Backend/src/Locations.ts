import db from "~/lib/db";
import { getFriends } from "./friends";
// ─── In-memory location store ────────────────────────────────────────────────
// Keeps the last known position for each user ID.
// An entry is considered stale after STALE_MS milliseconds.

const STALE_MS = 60*60*1000; // 1 hour

interface Entry {
  lat: number;
  lng: number;
  updatedAt: number; // Date.now()
}

const store = new Map<number, Entry>();

/**
 * Upserts the current position for a user.
 * Called on every POST /api/locations from the client.
 */
export const upsertLocation = (userId: number, lat: number, lng: number) => {
  store.set(userId, { lat, lng, updatedAt: Date.now() });
};

/**
 * Returns all non-stale locations, joined with avatar_url from the users table.
 * Called on every GET /api/locations from polls.
 */
export const getActiveLocations = (): Record<
  number,
  { lat: number; lng: number; avatarUrl: string | null }
> => {
  const now = Date.now();
  const result: Record<number, { lat: number; lng: number; avatarUrl: string | null }> = {};

  for (const [userId, entry] of store.entries()) {
    if (now - entry.updatedAt > STALE_MS) {
      // Prune stale entry while we're iterating
      store.delete(userId);
      continue;
    }

    // Look up avatar from the database
    const user = db
      .prepare("SELECT avatar_url as avatarUrl FROM users WHERE id = ?")
      .get(userId) as { avatarUrl: string } | null;

    result[userId] = {
      lat: entry.lat,
      lng: entry.lng,
      avatarUrl: user?.avatarUrl ?? null,
    };
  }

  return result;
};

export const getFriendsLocations = (userId: number) => {
  const allLocations = getActiveLocations();
  const friends = getFriends(userId);
  const friendIds = new Set<number>();

  for (const f of friends) {
    const friendId =
      f.sender_id === userId ? f.accepter_id : f.sender_id;
    friendIds.add(friendId);
  }

  const result: typeof allLocations = {};

  for (const [id, loc] of Object.entries(allLocations)) {
    if (friendIds.has(Number(id))) {
      result[Number(id)] = loc;
    }
  }

  return result;
};