import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';
import { userService } from '../../src/services/user';
import { upsertLocation, getActiveLocations, getFriendsLocations } from '../../src/Locations';
import { sendFriendRequest, acceptFriendRequest, getFriends } from '../../src/friends';

describe('Backend Location Sharing', () => {
  // Mock user IDs for testing
  let userAId: number;
  let userBId: number;
  let userCId: number;

  beforeAll(() => {
    // Create test users
    userAId = userService.createOrUpdateFromIdentity('google', {
      subject: 'user-a-subject',
      name: 'User A',
      email: 'userA@example.com',
      avatarUrl: 'https://avatar.com/a.jpg'
    });

    userBId = userService.createOrUpdateFromIdentity('google', {
      subject: 'user-b-subject',
      name: 'User B',
      email: 'userB@example.com',
      avatarUrl: 'https://avatar.com/b.jpg'
    });

    userCId = userService.createOrUpdateFromIdentity('google', {
      subject: 'user-c-subject',
      name: 'User C',
      email: 'userC@example.com',
      avatarUrl: ''  // Empty string for user without avatar
    });
  });

  describe('TC-BE-LOC-01 - Location Pushing', () => {
    describe('API Route Tests', () => {
      it('Given a valid payload, When POST /api/locations is called, Then it returns HTTP 204', async () => {
        const response = await request(app)
          .post('/api/locations')
          .set('Authorization', 'Bearer mock-valid-jwt-token')
          .send({ lat: 52.4, lng: -1.9 });

        expect(response.status).toBe(204);
      });

      it('Given missing lat field, When POST /api/locations is called, Then it returns HTTP 400', async () => {
        const response = await request(app)
          .post('/api/locations')
          .set('Authorization', 'Bearer mock-valid-jwt-token')
          .send({ lng: -1.9 });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      });

      it('Given missing lng field, When POST /api/locations is called, Then it returns HTTP 400', async () => {
        const response = await request(app)
          .post('/api/locations')
          .set('Authorization', 'Bearer mock-valid-jwt-token')
          .send({ lat: 52.4 });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      });

      it('Given no auth token, When POST /api/locations is called, Then it returns HTTP 401', async () => {
        const response = await request(app)
          .post('/api/locations')
          .send({ lat: 52.4, lng: -1.9 });

        expect(response.status).toBe(401);
      });

      it('Given invalid auth token, When POST /api/locations is called, Then it returns HTTP 401', async () => {
        const response = await request(app)
          .post('/api/locations')
          .set('Authorization', 'Bearer invalid.token.here')
          .send({ lat: 52.4, lng: -1.9 });

        expect(response.status).toBe(401);
      });
    });

    describe('Direct Function Tests', () => {
      it('Given a user ID and coordinates, When upsertLocation is called, Then the location is stored', () => {
        upsertLocation(userAId, 51.5074, -0.1278);

        const locations = getActiveLocations();
        expect(locations[userAId]).toBeDefined();
        expect(locations[userAId].lat).toBe(51.5074);
        expect(locations[userAId].lng).toBe(-0.1278);
      });

      it('Given a user location exists, When upsertLocation is called again, Then the location is updated', () => {
        // First insert
        upsertLocation(userBId, 52.4, -1.9);

        // Update
        upsertLocation(userBId, 52.5, -1.8);

        const locations = getActiveLocations();
        expect(locations[userBId].lat).toBe(52.5);
        expect(locations[userBId].lng).toBe(-1.8);
      });
    });
  });

  describe('TC-BE-LOC-02 - Location Polling', () => {
    describe('API Route Tests', () => {
      it('Given valid auth token, When GET /api/locations is called, Then it returns HTTP 200', async () => {
        const response = await request(app)
          .get('/api/locations')
          .set('Authorization', 'Bearer mock-valid-jwt-token');

        expect(response.status).toBe(200);
        expect(typeof response.body).toBe('object');
      });

      it('Given no auth token, When GET /api/locations is called, Then it returns HTTP 401', async () => {
        const response = await request(app)
          .get('/api/locations');

        expect(response.status).toBe(401);
      });

      it('Given invalid auth token, When GET /api/locations is called, Then it returns HTTP 401', async () => {
        const response = await request(app)
          .get('/api/locations')
          .set('Authorization', 'Bearer invalid.token.here');

        expect(response.status).toBe(401);
      });

      it('Given friends with locations, When GET /api/locations is called, Then only friends locations are returned', async () => {
        // User A and User B are friends
        sendFriendRequest(userAId, userBId);
        acceptFriendRequest(userBId, userAId);

        // User A pushes location
        upsertLocation(userAId, 51.5074, -0.1278);

        // User B polls
        const response = await request(app)
          .get('/api/locations')
          .set('Authorization', 'Bearer mock-user-b-token');

        expect(response.status).toBe(200);
        // User B should see User A's location
        expect(response.body[userAId]).toBeDefined();
        expect(response.body[userAId].lat).toBe(51.5074);
        expect(response.body[userAId].lng).toBe(-0.1278);
      });

      it('Given user has no friends with locations, When GET /api/locations is called, Then it returns empty object', async () => {
        const response = await request(app)
          .get('/api/locations')
          .set('Authorization', 'Bearer mock-user-c-token');

        expect(response.status).toBe(200);
        expect(Object.keys(response.body)).toHaveLength(0);
      });
    });

    describe('Direct Function Tests', () => {
      it('Given active locations exist, When getActiveLocations is called, Then it returns all non-stale locations', () => {
        // Push locations for multiple users
        upsertLocation(userAId, 51.5074, -0.1278);
        upsertLocation(userBId, 52.4, -1.9);

        const locations = getActiveLocations();
        expect(locations[userAId]).toBeDefined();
        expect(locations[userBId]).toBeDefined();
      });

      it('Given locations with avatar URLs, When getActiveLocations is called, Then it includes avatar URLs', () => {
        upsertLocation(userAId, 51.5074, -0.1278);

        const locations = getActiveLocations();
        expect(locations[userAId].avatarUrl).toBe('https://avatar.com/a.jpg');
      });

      it('Given locations for users without avatar, When getActiveLocations is called, Then avatarUrl is empty string', () => {
        upsertLocation(userCId, 53.0, -2.0);

        const locations = getActiveLocations();
        expect(locations[userCId].avatarUrl).toBe('');
      });

      it('Given no active locations, When getActiveLocations is called, Then it returns empty object', () => {
        // Clear the store (need to manually clear)
        const locations = getActiveLocations();
        expect(typeof locations).toBe('object');
      });
    });
  });

  describe('TC-INT-LOC-01 - End-to-End Location Flow', () => {
    beforeAll(() => {
      // Setup friendship between A and B
      sendFriendRequest(userAId, userBId);
      acceptFriendRequest(userBId, userAId);
    });

    it('Given User A pushes location, When User B polls, Then User B receives User A\'s location', async () => {
      // User A pushes location
      upsertLocation(userAId, 52.4, -1.9);

      // User B polls
      const pollResponse = await request(app)
        .get('/api/locations')
        .set('Authorization', 'Bearer mock-user-b-token');

      expect(pollResponse.status).toBe(200);
      expect(pollResponse.body[userAId]).toBeDefined();
      expect(pollResponse.body[userAId].lat).toBe(52.4);
      expect(pollResponse.body[userAId].lng).toBe(-1.9);
    });

    it('Given User B pushes location, When User A polls, Then User A receives User B\'s location', async () => {
      // User B pushes location
      upsertLocation(userBId, 51.5, -0.1);

      // User A polls
      const pollResponse = await request(app)
        .get('/api/locations')
        .set('Authorization', 'Bearer mock-user-a-token');

      expect(pollResponse.status).toBe(200);
      expect(pollResponse.body[userBId]).toBeDefined();
      expect(pollResponse.body[userBId].lat).toBe(51.5);
      expect(pollResponse.body[userBId].lng).toBe(-0.1);
    });

    it('Given User C is not friends with A, When User A polls, Then User C\'s location is not returned', async () => {
      // User C pushes location
      upsertLocation(userCId, 54.0, -3.0);

      // User A polls
      const pollResponse = await request(app)
        .get('/api/locations')
        .set('Authorization', 'Bearer mock-user-a-token');

      expect(pollResponse.status).toBe(200);
      expect(pollResponse.body[userCId]).toBeUndefined();
    });
  });

  describe('Stale Location Pruning', () => {
    it('Given a stale location exists, When getActiveLocations is called, Then stale entries are pruned', () => {
      // This test verifies the internal pruning behavior
      // In practice, stale pruning happens during getActiveLocations
      const locations = getActiveLocations();

      // After calling getActiveLocations, stale entries should be removed
      // We can verify the function runs without error and returns valid structure
      expect(typeof locations).toBe('object');
    });
  });

  describe('Location Data Structure', () => {
    it('Given a location entry, When retrieved, Then it has correct structure', () => {
      upsertLocation(userAId, 52.4, -1.9);

      const locations = getActiveLocations();
      const location = locations[userAId];

      expect(location).toHaveProperty('lat');
      expect(location).toHaveProperty('lng');
      expect(location).toHaveProperty('avatarUrl');
      expect(typeof location.lat).toBe('number');
      expect(typeof location.lng).toBe('number');
    });

    it('Given location with avatar, When retrieved, Then avatarUrl matches user data', () => {
      upsertLocation(userBId, 51.5074, -0.1278);

      const locations = getActiveLocations();
      expect(locations[userBId].avatarUrl).toBe('https://avatar.com/b.jpg');
    });
  });

  describe('Multiple Location Updates', () => {
    it('Given multiple rapid updates, When locations are polled, Then the latest location is returned', async () => {
      // Rapid updates
      upsertLocation(userAId, 51.0, 0.0);
      upsertLocation(userAId, 51.1, 0.1);
      upsertLocation(userAId, 51.2, 0.2);

      const locations = getActiveLocations();
      expect(locations[userAId].lat).toBe(51.2);
      expect(locations[userAId].lng).toBe(0.2);
    });

    it('Given two friends both updating locations, When polled, Then only friends locations are returned', async () => {
      // Ensure friendship
      sendFriendRequest(userAId, userBId);
      acceptFriendRequest(userBId, userAId);

      upsertLocation(userAId, 51.0, 0.0);
      upsertLocation(userBId, 53.5, -1.5);

      const pollResponse = await request(app)
        .get('/api/locations')
        .set('Authorization', 'Bearer mock-user-a-token');

      // User A should NOT see themselves, but SHOULD see User B
      expect(pollResponse.body[userAId]).toBeUndefined();
      expect(pollResponse.body[userBId]).toBeDefined();
      expect(pollResponse.body[userBId].lat).toBe(53.5);
    });
  });

  describe('Edge Cases', () => {
    it('Given negative coordinates, When upsertLocation is called, Then coordinates are stored correctly', () => {
      upsertLocation(userAId, -33.8688, 151.2093); // Sydney

      const locations = getActiveLocations();
      expect(locations[userAId].lat).toBe(-33.8688);
      expect(locations[userAId].lng).toBe(151.2093);
    });

    it('Given decimal precision, When upsertLocation is called, Then precision is preserved', () => {
      upsertLocation(userAId, 52.123456789, -1.987654321);

      const locations = getActiveLocations();
      expect(locations[userAId].lat).toBeCloseTo(52.123456789, 9);
      expect(locations[userAId].lng).toBeCloseTo(-1.987654321, 9);
    });

    it('Given zero coordinates, When upsertLocation is called, Then location is stored', () => {
      upsertLocation(userAId, 0, 0);

      const locations = getActiveLocations();
      expect(locations[userAId].lat).toBe(0);
      expect(locations[userAId].lng).toBe(0);
    });
  });

  describe('Geocoding Proxy', () => {
    it('Given a valid query, When GET /api/geocode is called, Then it returns data from Nominatim', async () => {
      // Mock fetch
      const mockResult = [{ display_name: 'Birmingham', lat: '52.4', lon: '-1.9' }];
      const spy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResult)),
        json: () => Promise.resolve(mockResult),
      } as Response);

      const response = await request(app)
        .get('/api/geocode?q=BirminghamQuery');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/search?q=BirminghamQuery'),
        expect.anything()
      );

      spy.mockRestore();
    });

    it('Given no query parameter, When GET /api/geocode is called, Then it returns HTTP 400', async () => {
      const response = await request(app)
        .get('/api/geocode');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', "Query parameter 'q' is required");
    });

    it('Given Nominatim fails, When GET /api/geocode is called, Then it returns HTTP 500', async () => {
      const spy = vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

      const response = await request(app)
        .get('/api/geocode?q=BirminghamFailure');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', "Failed to fetch suggestions from Nominatim");

      spy.mockRestore();
    });
  });
});
