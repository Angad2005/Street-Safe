import express from 'express';
import cors from 'cors';

import { GEOCODE_API, PORT } from '~/lib/config';
import { handleError } from '~/lib/errors';

import { init as initAuth } from "~/services/auth";
import { init as initUsers, userService } from '~/services/user';
import { init as initIdp } from '~/services/idp';
import { init as initPushNotifications } from '~/services/push-notifications';

import oauthRouter from './routers/auth';
import usersRouter from './routers/users';

import { getAllHazards, addHazard } from './Hazards';
import { upsertLocation, getActiveLocations } from './Locations';

import {
  acceptFriendRequest,
  getFriendRequests,
  getFriendRequestsSent,
  getFriends,
  rejectFriendRequest,
  removeFriend,
  sendFriendRequest
} from './friends';

import { authenticate, getUserId } from './services/auth/middleware';
import { point } from './routing/bboxGenerator';
import { generateRoute } from './routing/generateRoute';
import { PathResult, ptDist } from './routing/Pathfinding';

initAuth();
initUsers();
initIdp();
initPushNotifications();

const savedRoutes: { [key: number]: PathResult } = {};

export const app = express();

app.use(express.json());

const noCache = (req: any, res: { setHeader: (arg0: string, arg1: string) => void; }, next: () => void) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
};

app.use(noCache);

app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
      origin.endsWith('.vercel.app') ||
      origin === 'https://streetsafe.828101.xyz' ||
      origin === 'https://street-safe-wine.vercel.app'
    ) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
}));

app.use("/oauth2", oauthRouter);
app.use("/users", usersRouter);

app.get('/api/checkAuth',
  authenticate({ required: true }),
  (req, res) => {
    try {
      getUserId(req);
    } catch (error) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    res.status(200).json({ message: "Authenticated" });
  }
);

// ── Geocoding Proxy (RESOLVES CORS & NOMINATIM RATE LIMITING) ─────────
const geocodeCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1-hour cache

app.get('/api/geocode', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }
    if (q.trim().length < 3) {
      return res.status(400).json({ error: "Query parameter 'q' must be at least 3 characters" });
    }

    const queryKey = q.trim().toLowerCase();
    if (queryKey === "your location") {
      return res.json([]);
    }

    const cached = geocodeCache.get(queryKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return res.json(cached.data);
    }

    const geocodeUrl = `${GEOCODE_API}/search?q=${encodeURIComponent(q.trim())}&format=json&limit=5&addressdetails=1`;
    let primaryFailed = false;

    try {
      const response = await fetch(geocodeUrl, {
        headers: {
          'User-Agent': 'StreetSafeApp/1.0 (contact@streetsafe.org)',
          'Accept': 'application/json',
        },
      });
      if (response && response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          geocodeCache.set(queryKey, { timestamp: Date.now(), data });
          return res.json(data);
        }
      }
    } catch (fetchErr) {
      primaryFailed = true;
    }

    // Try Photon fallback if primary Nominatim service failed or yielded no results
    try {
      const fallbackUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(q.trim())}&limit=5`;
      const fallbackRes = await fetch(fallbackUrl, {
        headers: {
          'User-Agent': 'StreetSafeApp/1.0 (contact@streetsafe.org)',
          'Accept': 'application/json'
        }
      });
      if (fallbackRes && fallbackRes.ok) {
        const fallbackJson = await fallbackRes.json();
        const fallbackData = (fallbackJson.features || []).map((f: any) => ({
          place_id: f.properties?.osm_id || Math.floor(Math.random() * 1000000),
          display_name: [
            f.properties?.name,
            f.properties?.street,
            f.properties?.city,
            f.properties?.state,
            f.properties?.country
          ].filter(Boolean).join(", "),
          lat: String(f.geometry?.coordinates?.[1] ?? ""),
          lon: String(f.geometry?.coordinates?.[0] ?? "")
        }));

        geocodeCache.set(queryKey, { timestamp: Date.now(), data: fallbackData });
        return res.json(fallbackData);
      }
    } catch (fallbackErr) {
      console.warn("Geocoding fallback failed:", fallbackErr);
    }

    if (primaryFailed) {
      return res.status(500).json({ error: "Failed to fetch suggestions from Nominatim" });
    }

    return res.json([]);
  } catch (error) {
    console.error("Geocoding proxy error:", error);
    return res.status(500).json({ error: "Failed to fetch suggestions from Nominatim" });
  }
});

app.post('/api/getFriendRoute',
  authenticate({ required: true }),
  async (req, res) => {
    const userId = getUserId(req)!;
    const friendId = req.body.friendId;

    // Check if the users are friends
    if (!getFriends(userId).some(friend => friend.sender_id === friendId || friend.accepter_id === friendId)) {
      return res.status(400).json({ error: "You are not authorized to view this person's route" });
    }

    const path = savedRoutes[friendId];
    if (path) {
      return res.status(200).json(path);
    } else {
      return res.status(404).json({ error: "No route found for the specified friend" });
    }
  }
);

// ── ROUTE ─────────────────────────────────────────────────────────────
app.post('/api/route',
  authenticate({ required: true }),
  async (req, res) => {
    const userId = getUserId(req);

    try {
      const { startLat, startLng, endLat, endLng } = req.body || {};

      if (
        startLat == null || startLng == null || endLat == null || endLng == null ||
        isNaN(Number(startLat)) || isNaN(Number(startLng)) || isNaN(Number(endLat)) || isNaN(Number(endLng))
      ) {
        return res.status(400).json({ error: "Missing or invalid startLat, startLng, endLat, or endLng" });
      }

      const startPoint = {
        lat: Number(startLat),
        lng: Number(startLng)
      } as point;
      const endPoint = {
        lat: Number(endLat),
        lng: Number(endLng)
      } as point;

      console.log('Start point:', startPoint);
      console.log('End point:', endPoint);

      let path: PathResult;
      try {
        path = await generateRoute(startPoint, endPoint);
      } catch (err) {
        console.warn("Pathfinding generated fallback route due to:", err);
        const dist = ptDist(startPoint, endPoint);
        path = {
          found: true,
          totalCost: dist,
          steps: [
            { nodeId: -1, point: startPoint },
            { nodeId: -2, point: endPoint }
          ]
        };
      }

      if (!path || !path.found || !('steps' in path) || !path.steps || path.steps.length === 0) {
        const dist = ptDist(startPoint, endPoint);
        path = {
          found: true,
          totalCost: dist,
          steps: [
            { nodeId: -1, point: startPoint },
            { nodeId: -2, point: endPoint }
          ]
        };
      }

      if (userId) {
        savedRoutes[userId] = path;
      }

      return res.status(200).json(path);

    } catch (error) {
      console.error("Route error:", error);
      return res.status(500).json({ error: "Failed to generate route" });
    }
  }
);

// ── Hazards ───────────────────────────────────────────────────────────
app.get('/api/hazards', (req, res) => {
  try {
    const data = getAllHazards();
    res.json(data);
  } catch {
    res.status(500).json({ error: "Database fetch failed" });
  }
});

app.post('/api/addhazards', (req, res) => {
  try {
    const { Category, Latitude, Longitude } = req.body;

    if (!Category || !Latitude || !Longitude) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = addHazard(Category, Latitude, Longitude);
    res.status(201).json({ message: "Hazard added!", id: result.lastInsertRowid });

  } catch {
    res.status(500).json({ error: "Failed to save hazard" });
  }
});

// ── Location sharing (AUTH REQUIRED) ──────────────────────────────────
app.post('/api/locations',
  authenticate({ required: true }),
  (req, res) => {
    const { lat, lng } = req.body;
    const userId = getUserId(req)!;

    if (lat == null || lng == null) {
      return res.status(400).json({ error: 'Missing lat or lng' });
    }

    upsertLocation(Number(userId), Number(lat), Number(lng));
    res.status(204).send();
  }
);

// GET /api/locations — client polls for friend positions
app.get('/api/locations',
  authenticate({ required: true }),
  (req, res) => {
    try {
      const locations = getActiveLocations();
      const userId = getUserId(req)!;
      const friends = getFriends(userId);

      const filteredLocations: Record<number, any> = {};

      for (const friend of friends) {
        const friendId =
          friend.sender_id === userId
            ? friend.accepter_id
            : friend.sender_id;

        if (locations[friendId]) {
          filteredLocations[friendId] = locations[friendId];
        }
      }

      res.json(filteredLocations);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch locations" });
    }
  }
);

// ── Friends ───────────────────────────────────────────────────────────
app.post("/api/createFriendRequest",
  authenticate({ required: true }),
  (req, res) => {
    try {
      const userId = getUserId(req)!;
      const { friendEmail } = req.body;

      const friendId = userService.getIdByEmail(friendEmail);
      if (!friendId) {
        return res.status(404).json({ error: "Friend not found" });
      }

      const result = sendFriendRequest(userId, friendId);
      res.status(201).json({ message: result });

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create friend request" });
    }
  }
);

app.post("/api/acceptFriendRequest",
  authenticate({ required: true }),
  (req, res) => {
    try {
      const userId = getUserId(req)!;
      const { friendId } = req.body;

      acceptFriendRequest(userId, friendId);
      res.status(201).json({ message: "Friend request accepted" });

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to accept friend request" });
    }
  }
);

app.post("/api/rejectFriendRequest",
  authenticate({ required: true }),
  (req, res) => {
    try {
      const userId = getUserId(req)!;
      const { friendId } = req.body;

      rejectFriendRequest(userId, friendId);
      res.status(201).json({ message: "Friend request rejected" });

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to reject friend request" });
    }
  }
);

app.post("/api/removeFriend",
  authenticate({ required: true }),
  (req, res) => {
    try {
      const userId = getUserId(req)!;
      const { friendId } = req.body;

      removeFriend(userId, friendId);
      res.status(201).json({ message: "Friend removed" });

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to remove friend" });
    }
  }
);

app.post("/api/deleteFriendRequest",
  authenticate({ required: true }),
  (req, res) => {
    try {
      const userId = getUserId(req)!;
      const { friendId } = req.body;

      rejectFriendRequest(friendId, userId);
      res.status(201).json({ message: "Friend request deleted" });

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete friend request" });
    }
  }
);

app.get("/api/getFriends",
  authenticate({ required: true }),
  (req, res) => {
    try {
      const userId = getUserId(req)!;
      const friends = getFriends(userId);
      res.status(200).json(friends);

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get friends" });
    }
  }
);

app.get("/api/getFriendRequests",
  authenticate({ required: true }),
  (req, res) => {
    try {
      const userId = getUserId(req)!;
      const requests = getFriendRequests(userId);
      res.status(200).json(requests);

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get friend requests" });
    }
  }
);

app.get("/api/getFriendRequestsSent",
  authenticate({ required: true }),
  (req, res) => {
    try {
      const userId = getUserId(req)!;
      const sent = getFriendRequestsSent(userId);
      res.status(200).json(sent);

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get sent requests" });
    }
  }
);

// ── Error handler ─────────────────────────────────────────────────────
app.use(handleError);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Backend API running on port ${PORT}`);
  });
}
