import request from 'supertest';
import { app } from '../../src/index';
import { userService } from '../../src/services/user';
import {
  sendFriendRequest,
  getFriends,
  getFriendRequests,
  getFriendRequestsSent,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend
} from '../../src/friends';

describe('Backend Friends Management', () => {
  const mockTokenA = 'mock-user-A-jwt';
  const mockTokenB = 'mock-user-B-jwt';
  const mockTokenC = 'mock-user-C-jwt';

  let userAId: number;
  let userBId: number;
  let userCId: number;

  beforeAll(() => {
    // Seed users for integration tests
    userAId = userService.createOrUpdateFromIdentity('google', {
      subject: 'user-A-subject',
      name: 'User A',
      email: 'test1@example.com',
      avatarUrl: 'http://example.com/a.png'
    });
    userBId = userService.createOrUpdateFromIdentity('google', {
      subject: 'user-B-subject',
      name: 'User B',
      email: 'test2@example.com',
      avatarUrl: 'http://example.com/b.png'
    });
    userCId = userService.createOrUpdateFromIdentity('google', {
      subject: 'user-C-subject',
      name: 'User C',
      email: 'test3@example.com',
      avatarUrl: 'http://example.com/c.png'
    });
  });

  // ─────────────────────────────────────────────────────────────
  // TC-BE-FRI-01 - Connections Loading
  // ─────────────────────────────────────────────────────────────
  describe('TC-BE-FRI-01 - Connections Loading', () => {
    describe('API Route Tests', () => {
      it('Given a valid auth token, When GET /api/getFriends is called, Then it returns HTTP 200 with an array', async () => {
        const response = await request(app)
          .get('/api/getFriends')
          .set('Authorization', `Bearer ${mockTokenA}`);
        
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });

      it('Given a valid auth token, When GET /api/getFriendRequests is called, Then it returns HTTP 200 with an array', async () => {
        const response = await request(app)
          .get('/api/getFriendRequests')
          .set('Authorization', `Bearer ${mockTokenA}`);
        
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });

      it('Given a valid auth token, When GET /api/getFriendRequestsSent is called, Then it returns HTTP 200 with an array', async () => {
        const response = await request(app)
          .get('/api/getFriendRequestsSent')
          .set('Authorization', `Bearer ${mockTokenA}`);
        
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });

      it('Given no auth token, When GET /api/getFriends is called, Then it returns HTTP 401', async () => {
        const response = await request(app)
          .get('/api/getFriends');
        
        expect(response.status).toBe(401);
      });

      it('Given invalid auth token, When GET /api/getFriends is called, Then it returns HTTP 401', async () => {
        const response = await request(app)
          .get('/api/getFriends')
          .set('Authorization', 'Bearer invalid-token');
        
        expect(response.status).toBe(401);
      });
    });

    describe('Direct Function Tests', () => {
      it('Given a new user with no friends, When getFriends is called, Then it returns an empty array', () => {
        const friends = getFriends(userAId);
        expect(Array.isArray(friends)).toBe(true);
        expect(friends.length).toBe(0);
      });

      it('Given a new user with no pending requests, When getFriendRequests is called, Then it returns an empty array', () => {
        const requests = getFriendRequests(userAId);
        expect(Array.isArray(requests)).toBe(true);
        expect(requests.length).toBe(0);
      });

      it('Given a new user with no sent requests, When getFriendRequestsSent is called, Then it returns an empty array', () => {
        const sent = getFriendRequestsSent(userAId);
        expect(Array.isArray(sent)).toBe(true);
        expect(sent.length).toBe(0);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Friend Request Flow Tests
  // ─────────────────────────────────────────────────────────────
  describe('Friend Request Flow', () => {
    describe('TC-INT-FRI-01 - Friend Request & Approval Flow (Integration)', () => {
      it('Given User A sends a friend request and User B accepts, Then they become friends', async () => {
        // 1. User A sends request to User B via email
        const sendRes = await request(app)
          .post('/api/createFriendRequest')
          .set('Authorization', `Bearer ${mockTokenA}`)
          .send({ friendEmail: 'test2@example.com' });
        
        expect([200, 201]).toContain(sendRes.status);

        // 2. Verify the request appears in User B's incoming requests
        const userBRequests = getFriendRequests(userBId);
        const foundRequest = userBRequests.find(r => r.sender_id === userAId);
        expect(foundRequest).toBeDefined();
        expect(foundRequest?.status).toBe('pending');

        // 3. User B accepts the request from User A
        const acceptRes = await request(app)
          .post('/api/acceptFriendRequest')
          .set('Authorization', `Bearer ${mockTokenB}`)
          .send({ friendId: userAId });
        
        expect(acceptRes.status).toBe(201);

        // 4. Verify they are now friends (appear in each other's friends list)
        const userAFriends = getFriends(userAId);
        const userBFriends = getFriends(userBId);
        
        const userAHasB = userAFriends.some(f => 
          (f.sender_id === userAId && f.accepter_id === userBId) ||
          (f.sender_id === userBId && f.accepter_id === userAId)
        );
        const userBHasA = userBFriends.some(f => 
          (f.sender_id === userAId && f.accepter_id === userBId) ||
          (f.sender_id === userBId && f.accepter_id === userAId)
        );
        
        expect(userAHasB).toBe(true);
        expect(userBHasA).toBe(true);
      });
    });

    describe('Direct Function Tests', () => {
      it('Given User A sends a request to User C, When sendFriendRequest succeeds, Then it returns SUCCESS', () => {
        const result = sendFriendRequest(userAId, userCId);
        expect(result).toBe(2); // SUCCESS enum value
      });

      it('Given User A already sent a request to User C, When sending again, Then it returns ALREADY_SENT', () => {
        const result = sendFriendRequest(userAId, userCId);
        expect(result).toBe(0); // ALREADY_SENT enum value
      });

      it('Given User A sends request to non-existent user, When sendFriendRequest is called, Then it returns NOT_FOUND', () => {
        const fakeUserId = 99999;
        const result = sendFriendRequest(userAId, fakeUserId);
        expect(result).toBe(4); // NOT_FOUND enum value
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Mutual Friend Request (Accept by Sending)
  // ─────────────────────────────────────────────────────────────
  describe('Mutual Friend Request (Accept by Sending)', () => {
    let mutualA: number;
    let mutualB: number;

    beforeAll(() => {
      // Create fresh users for mutual tests
      mutualA = userService.createOrUpdateFromIdentity('google', {
        subject: 'mutual-tester-A',
        name: 'Mutual A',
        email: 'mutual1@example.com',
        avatarUrl: 'http://example.com/mutual1.png'
      });
      mutualB = userService.createOrUpdateFromIdentity('google', {
        subject: 'mutual-tester-B',
        name: 'Mutual B',
        email: 'mutual2@example.com',
        avatarUrl: 'http://example.com/mutual2.png'
      });

      // User B sends request to User A
      const result = sendFriendRequest(mutualB, mutualA);
      expect(result).toBe(2); // Should succeed (SUCCESS = 2)
    });

    it('Given User A receives a pending request from User B, When User A sends request back to User B, Then it auto-accepts and returns ACCEPTED', () => {
      const result = sendFriendRequest(mutualA, mutualB);
      expect(result).toBe(3); // ACCEPTED enum value
    });

    it('Given the mutual acceptance, When checking friends, Then both users are friends', () => {
      const userAFriends = getFriends(mutualA);
      const hasUserB = userAFriends.some(f => 
        (f.sender_id === mutualA && f.accepter_id === mutualB) ||
        (f.sender_id === mutualB && f.accepter_id === mutualA)
      );
      expect(hasUserB).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Reject Friend Request
  // ─────────────────────────────────────────────────────────────
  describe('Reject Friend Request', () => {
    beforeAll(() => {
      // Create a new user pair for reject tests
      userService.createOrUpdateFromIdentity('google', {
        subject: 'reject-tester-A',
        name: 'Reject A',
        email: 'reject1@example.com',
        avatarUrl: 'http://example.com/reject1.png'
      });
      userService.createOrUpdateFromIdentity('google', {
        subject: 'reject-tester-B',
        name: 'Reject B',
        email: 'reject2@example.com',
        avatarUrl: 'http://example.com/reject2.png'
      });
    });

    it('Given User A sends request to User B, When User B rejects, Then the request is removed', async () => {
      // Get the actual user IDs
      const rejectA = userService.getIdByEmail('reject1@example.com')!;
      const rejectB = userService.getIdByEmail('reject2@example.com')!;

      // Send request
      sendFriendRequest(rejectA, rejectB);

      // Verify request exists
      const requestsBefore = getFriendRequests(rejectB);
      expect(requestsBefore.some(r => r.sender_id === rejectA)).toBe(true);

      // Reject request
      await request(app)
        .post('/api/rejectFriendRequest')
        .set('Authorization', `Bearer mock-user-id-${rejectB}`)
        .send({ friendId: rejectA });

      // Verify request is removed
      const requestsAfter = getFriendRequests(rejectB);
      expect(requestsAfter.some(r => r.sender_id === rejectA)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Remove Friend
  // ─────────────────────────────────────────────────────────────
  describe('Remove Friend', () => {
    it('Given User A and User B are friends, When removeFriend is called, Then they are no longer friends', () => {
      // Create fresh users for this test
      userService.createOrUpdateFromIdentity('google', {
        subject: 'remove-tester-A',
        name: 'Remove A',
        email: 'remove1@example.com',
        avatarUrl: 'http://example.com/remove1.png'
      });
      userService.createOrUpdateFromIdentity('google', {
        subject: 'remove-tester-B',
        name: 'Remove B',
        email: 'remove2@example.com',
        avatarUrl: 'http://example.com/remove2.png'
      });

      const removeA = userService.getIdByEmail('remove1@example.com')!;
      const removeB = userService.getIdByEmail('remove2@example.com')!;

      // Make them friends
      sendFriendRequest(removeA, removeB);
      acceptFriendRequest(removeB, removeA);

      // Verify they are friends
      const friendsBefore = getFriends(removeA);
      expect(friendsBefore.some(f => 
        (f.sender_id === removeA && f.accepter_id === removeB) ||
        (f.sender_id === removeB && f.accepter_id === removeA)
      )).toBe(true);

      // Remove friend
      removeFriend(removeA, removeB);

      // Verify they are no longer friends
      const friendsAfter = getFriends(removeA);
      expect(friendsAfter.some(f => 
        (f.sender_id === removeA && f.accepter_id === removeB) ||
        (f.sender_id === removeB && f.accepter_id === removeA)
      )).toBe(false);
    });

    it('Given users are not friends, When removeFriend is called, Then no error occurs', () => {
      const fakeFriendId = 99999;
      // Should not throw
      expect(() => removeFriend(userAId, fakeFriendId)).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // API Endpoint Tests
  // ─────────────────────────────────────────────────────────────
  describe('API Endpoint Tests', () => {
    it('Given no auth token, When POST /api/createFriendRequest is called, Then it returns HTTP 401', async () => {
      const response = await request(app)
        .post('/api/createFriendRequest')
        .send({ friendEmail: 'test@example.com' });
      
      expect(response.status).toBe(401);
    });

    it('Given invalid auth token, When POST /api/acceptFriendRequest is called, Then it returns HTTP 401', async () => {
      const response = await request(app)
        .post('/api/acceptFriendRequest')
        .set('Authorization', 'Bearer invalid-token')
        .send({ friendId: 1 });
      
      expect(response.status).toBe(401);
    });

    it('Given invalid auth token, When POST /api/rejectFriendRequest is called, Then it returns HTTP 401', async () => {
      const response = await request(app)
        .post('/api/rejectFriendRequest')
        .set('Authorization', 'Bearer invalid-token')
        .send({ friendId: 1 });
      
      expect(response.status).toBe(401);
    });

    it('Given invalid auth token, When POST /api/removeFriend is called, Then it returns HTTP 401', async () => {
      const response = await request(app)
        .post('/api/removeFriend')
        .set('Authorization', 'Bearer invalid-token')
        .send({ friendId: 1 });
      
      expect(response.status).toBe(401);
    });

    it('Given User A tries to send request to non-existent email, When POST /api/createFriendRequest is called, Then it returns HTTP 404', async () => {
      const response = await request(app)
        .post('/api/createFriendRequest')
        .set('Authorization', `Bearer ${mockTokenA}`)
        .send({ friendEmail: 'nonexistent@example.com' });
      
      expect(response.status).toBe(404);
    });

    it('Given User A already has pending request to User B, When sending again, Then it returns HTTP 200 or 201 with message', async () => {
      // Send duplicate request
      const response = await request(app)
        .post('/api/createFriendRequest')
        .set('Authorization', `Bearer ${mockTokenA}`)
        .send({ friendEmail: 'test2@example.com' });
      
      expect([200, 201]).toContain(response.status);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Edge Cases
  // ─────────────────────────────────────────────────────────────
  describe('Edge Cases', () => {
    it('Given two users are already friends, When trying to send another request, Then it returns ALREADY_FRIEND status', () => {
      // Create fresh users for this test
      userService.createOrUpdateFromIdentity('google', {
        subject: 'edge-case-A',
        name: 'Edge A',
        email: 'edge1@example.com',
        avatarUrl: 'http://example.com/edge1.png'
      });
      userService.createOrUpdateFromIdentity('google', {
        subject: 'edge-case-B',
        name: 'Edge B',
        email: 'edge2@example.com',
        avatarUrl: 'http://example.com/edge2.png'
      });

      const edgeA = userService.getIdByEmail('edge1@example.com')!;
      const edgeB = userService.getIdByEmail('edge2@example.com')!;

      // Make them friends
      sendFriendRequest(edgeA, edgeB);
      acceptFriendRequest(edgeB, edgeA);

      // Try to send another request
      const result = sendFriendRequest(edgeA, edgeB);
      expect(result).toBe(1); // ALREADY_FRIEND enum value
    });

    it('Given empty friends list, When checking friends, Then it returns empty array', () => {
      const friends = getFriends(userCId);
      expect(friends).toEqual([]);
    });

    it('Given friend request data structure, When retrieved, Then it has correct shape', () => {
      // Create a request to check structure
      userService.createOrUpdateFromIdentity('google', {
        subject: 'structure-tester-A',
        name: 'Structure A',
        email: 'structure1@example.com',
        avatarUrl: 'http://example.com/struct1.png'
      });
      userService.createOrUpdateFromIdentity('google', {
        subject: 'structure-tester-B',
        name: 'Structure B',
        email: 'structure2@example.com',
        avatarUrl: 'http://example.com/struct2.png'
      });

      const structA = userService.getIdByEmail('structure1@example.com')!;
      const structB = userService.getIdByEmail('structure2@example.com')!;

      sendFriendRequest(structA, structB);
      const requests = getFriendRequests(structB);

      if (requests.length > 0) {
        const request = requests[0];
        expect(request).toHaveProperty('id');
        expect(request).toHaveProperty('sender_id');
        expect(request).toHaveProperty('accepter_id');
        expect(request).toHaveProperty('status');
        expect(request).toHaveProperty('created_at');
        expect(request.status).toBe('pending');
      }
    });
  });
});
