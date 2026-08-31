import express from 'express';
import cors from 'cors';

import { GEOCODE_API, PORT } from '~/lib/config';
import { handleError } from '~/lib/errors';

import { init as initAuth } from "~/services/auth"
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
import { PathResult } from './routing/Pathfinding';

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


app.use(cors({                                                                                                                         
      origin: [                                                                                                                            
        'http://localhost:8081',                                                                                                           
        'https://streetsafe.828101.xyz',                                                                                                   
        'https://street-safe-wine.vercel.app' // Add your Vercel origin here                                                               
      ]                                                                                                                                    
    }));

app.use("/oauth2", oauthRouter);
app.use("/users", usersRouter);

app.get('/api/checkAuth',
  authenticate({ required: true }),
  (req, res) => {
  try {
    getUserId(req)!;
  } catch (error) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  res.status(200).json({ message: "Authenticated" });
});

// ── Geocoding Proxy (RESOLVES CORS FOR WEB) ──────────────────────────
app.get('/api/geocode', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    const response = await fetch(
      `${GEOCODE_API}/search?q=${encodeURIComponent(q as string)}&format=json&limit=5`,
      {
        headers: {
          'User-Agent': 'StreetSafeBackend/1.0',
        },
      }
    );
    const data = await response.json();
    return res.json(data);

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
  })

// ── ROUTE (PUBLIC - NO AUTH) ─────────────────────────────────────────
app.post('/api/route',
  authenticate({ required: true }),
  async (req, res) => {
    const userId = getUserId(req);

  try {
    const startPoint = {
      lat: req.body.startLat,
      lng: req.body.startLng
    } as point;
    const endPoint = {
      lat: req.body.endLat,
      lng: req.body.endLng
    } as point;

    console.log(startPoint);
    console.log(endPoint);

    console.log('Start point:', startPoint);
    console.log('End point:', endPoint);
    const path = await generateRoute(startPoint, endPoint);

    if (userId) {
      savedRoutes[userId] = path;
    }

    return res.status(200).json(path);

  } catch (error) {
    console.error("Route error:", error);
    return res.status(500).json({ error: "Failed to generate route" });
  }
});

// ── Hazards ─────────────────────────────────────────
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

// ── Location sharing (AUTH REQUIRED) ─────────────────────────────────────────
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
});

// GET /api/locations  — client polls for friend positions
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
});

// ── Friends ─────────────────────────────────────────
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

// ── Error handler ─────────────────────────────────────────
app.use(handleError);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Backend API running on port ${PORT}`);
  });
}
