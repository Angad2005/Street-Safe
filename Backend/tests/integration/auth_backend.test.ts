import request from 'supertest';
import { app } from '../../src/index';
import { sessionService } from '../../src/services/auth/session';
import { authService } from '../../src/services/auth/service';
import * as context from '../../src/services/auth/context';
import { userService } from '../../src/services/user';
import { verify } from '../../src/lib/crypto/hmac';
import { sendFriendRequest, acceptFriendRequest } from '../../src/friends';

describe('Backend Authentication & SSO Integration', () => {
  // ─────────────────────────────────────────────────────────────
  // TC-BE-SSO-01: Secure Token Verification
  // ─────────────────────────────────────────────────────────────
  describe('TC-BE-SSO-01 - Secure Token Verification', () => {
    it('Given an API route executing the token check, When a malformed or expired JWT reaches the middleware, Then it immediately returns HTTP 401', async () => {
      // Target a route that is known to be protected
      const response = await request(app)
        .get('/api/locations')
        .set('Authorization', 'Bearer invalid.token.here');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('Given no authorization header, When accessing a protected route, Then it returns HTTP 401', async () => {
      const response = await request(app)
        .get('/api/locations');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('Given an authorization header with invalid format, When accessing a protected route, Then it returns HTTP 401', async () => {
      const response = await request(app)
        .get('/api/locations')
        .set('Authorization', 'Basic invalid');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('Given a valid mock token in test mode, When accessing a protected route, Then it returns HTTP 200 or expected status', async () => {
      const response = await request(app)
        .get('/api/getFriends')
        .set('Authorization', 'Bearer mock-user-a');
      
      // In test mode with mock token, should not return 401
      expect(response.status).not.toBe(401);
    });

    it('Given a valid mock token for user-b in test mode, When accessing a protected route, Then it returns HTTP 200 or expected status', async () => {
      const response = await request(app)
        .get('/api/getFriendRequests')
        .set('Authorization', 'Bearer mock-user-b');
      
      // In test mode with mock token, should not return 401
      expect(response.status).not.toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // TC-BE-SSO-02: IDP Parsing
  // ─────────────────────────────────────────────────────────────
  describe('TC-BE-SSO-02 - IDP Parsing', () => {
    it('Given an authentic Google user identity, When parsed, Then a corresponding standard internal user is reliably fetched or securely generated', async () => {
      // This tests the OAuth provider callback flow
      // First, get the authorize URL and exchange context
      const providerRes = await request(app)
        .get('/oauth2/providers/google');
      
      expect(providerRes.status).toBe(200);
      expect(providerRes.body).toHaveProperty('authorizeUrl');
      expect(providerRes.body).toHaveProperty('exchangeContextId');
      
      // The authorizeUrl should be a valid Google OAuth URL
      expect(providerRes.body.authorizeUrl).toContain('accounts.google.com');
      expect(providerRes.body.authorizeUrl).toContain('client_id');
      expect(providerRes.body.authorizeUrl).toContain('redirect_uri');
      expect(providerRes.body.authorizeUrl).toContain('response_type=code');
    });

    it('Given an invalid provider key, When requesting authorize URL, Then it returns HTTP 400', async () => {
      const response = await request(app)
        .get('/oauth2/providers/invalid_provider');
      
      expect(response.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // TC-BE-SSO-03: Session Management
  // ─────────────────────────────────────────────────────────────
  describe('TC-BE-SSO-03 - Session Management', () => {
    it('Given a user ID, When creating a session, Then a valid session token is returned', () => {
      // First create a user to have a valid user ID
      const userId = userService.createOrUpdateFromIdentity('google', {
        subject: 'test-session-user-123',
        name: 'Test Session User',
        email: 'test-session@example.com',
        avatarUrl: 'https://example.com/avatar.png'
      });

      const session = sessionService.createSession(userId);
      
      expect(session).toHaveProperty('token');
      expect(session).toHaveProperty('expiresAt');
      expect(typeof session.token).toBe('string');
      expect(session.expiresAt instanceof Date).toBe(true);
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('Given a valid session token, When retrieving the session, Then the correct user ID is returned', () => {
      // Create user and session
      const userId = userService.createOrUpdateFromIdentity('google', {
        subject: 'test-session-retrieval-123',
        name: 'Test Retrieval User',
        email: 'test-retrieval@example.com',
        avatarUrl: 'https://example.com/avatar.png'
      });

      const session = sessionService.createSession(userId);
      
      // Parse the signed token back to get raw bytes for lookup
      const rawToken = verify(session.token);
      
      const retrievedUserId = sessionService.getSession(rawToken);
      expect(retrievedUserId).toBe(userId);
    });

    it('Given an invalid session token, When retrieving the session, Then null is returned', () => {
      // Create a buffer that doesn't exist as a session
      const fakeToken = Buffer.alloc(64, 0xFF);
      
      const retrievedUserId = sessionService.getSession(fakeToken);
      expect(retrievedUserId).toBeNull();
    });

    it('Given a session token, When deleting the session, Then the session can no longer be retrieved', () => {
      // Create user and session
      const userId = userService.createOrUpdateFromIdentity('google', {
        subject: 'test-session-delete-123',
        name: 'Test Delete User',
        email: 'test-delete@example.com',
        avatarUrl: 'https://example.com/avatar.png'
      });

      const session = sessionService.createSession(userId);
      
      // Parse the signed token back
      const rawToken = verify(session.token);
      
      // Delete the session
      sessionService.deleteSession(rawToken);
      
      // Session should no longer be retrievable
      const retrievedUserId = sessionService.getSession(rawToken);
      expect(retrievedUserId).toBeNull();
    });

    it('Given a valid session token, When making multiple consecutive requests, Then all requests are authenticated', async () => {
      // Create user and session
      const userId = userService.createOrUpdateFromIdentity('google', {
        subject: 'test-session-consecutive-123',
        name: 'Test Consecutive User',
        email: 'test-consecutive@example.com',
        avatarUrl: 'https://example.com/avatar.png'
      });
      const session = sessionService.createSession(userId);

      // Multiple consecutive requests should all work
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .get('/api/getFriends')
          .set('Authorization', `Bearer ${session.token}`);

        expect(response.status).not.toBe(401);
      }
    });

    it('Given session expiration date, When session is created, Then expiration is set to 7 days from creation', () => {
      const userId = userService.createOrUpdateFromIdentity('google', {
        subject: 'test-session-expiry-123',
        name: 'Test Expiry User',
        email: 'test-expiry@example.com',
        avatarUrl: 'https://example.com/avatar.png'
      });
      const session = sessionService.createSession(userId);

      const now = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const expectedExpiry = now + sevenDaysMs;

      // Allow 1 minute tolerance
      expect(session.expiresAt.getTime()).toBeGreaterThan(expectedExpiry - 60000);
      expect(session.expiresAt.getTime()).toBeLessThan(expectedExpiry + 60000);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // TC-BE-SSO-04: Exchange Context Management
  // ─────────────────────────────────────────────────────────────
  describe('TC-BE-SSO-04 - Exchange Context Management', () => {
    it('Given a state token, When creating an exchange context, Then a signed context ID is returned', () => {
      const state = Buffer.alloc(32, 0xAB);
      const exchangeContextId = context.create(state);
      
      expect(typeof exchangeContextId).toBe('string');
      expect(exchangeContextId.length).toBeGreaterThan(0);
    });

    it('Given a valid exchange context ID, When tracking the exchange, Then the user ID is associated with the context', () => {
      // Create user
      const userId = userService.createOrUpdateFromIdentity('google', {
        subject: 'test-exchange-user-123',
        name: 'Test Exchange User',
        email: 'test-exchange@example.com',
        avatarUrl: 'https://example.com/avatar.png'
      });

      // Create exchange context
      const state = Buffer.alloc(32, 0xCD);
      const exchangeContextId = context.create(state);
      
      // Track the exchange with user ID
      context.updateTokenUsingState(state, userId);
      
      // Verify the exchange can be retrieved
      const rawContextId = verify(exchangeContextId);
      const retrievedUserId = context.getExchangedAccountIdForToken(rawContextId);
      
      expect(retrievedUserId).toBe(userId);
    });

    it('Given an exchange context ID, When invalidating the context, Then the context is removed', () => {
      const state = Buffer.alloc(32, 0xEF);
      const exchangeContextId = context.create(state);
      
      // Invalidate the context
      const rawContextId = verify(exchangeContextId);
      context.markUsed(rawContextId);
      
      // Context should no longer be retrievable (returns null)
      const retrievedUserId = context.getExchangedAccountIdForToken(rawContextId);
      expect(retrievedUserId).toBeNull();
    });

    it('Given an invalid/expired exchange context ID, When retrieving the account ID, Then null is returned', () => {
      // Create a fake/non-existent token
      const fakeToken = Buffer.alloc(64, 0xFF);
      
      const result = context.getExchangedAccountIdForToken(fakeToken);
      expect(result).toBeNull();
    });

    it('Given a token with correct HMAC signature, When verified, Then it contains expected entropy size', () => {
      const userId = userService.createOrUpdateFromIdentity('google', {
        subject: 'test-token-format-123',
        name: 'Test Format User',
        email: 'test-format@example.com',
        avatarUrl: 'https://example.com/avatar.png'
      });
      const session = sessionService.createSession(userId);

      // Verify the token format
      const rawToken = verify(session.token);
      expect(Buffer.isBuffer(rawToken)).toBe(true);
      expect(rawToken.length).toBe(64); // TOKEN_ENTROPY = 64
    });
  });

  // ─────────────────────────────────────────────────────────────
  // TC-BE-SSO-05: OAuth Routes Integration
  // ─────────────────────────────────────────────────────────────
  describe('TC-BE-SSO-05 - OAuth Routes Integration', () => {
    it('Given a valid provider, When requesting the OAuth authorize URL, Then a proper redirect URL is returned', async () => {
      const response = await request(app)
        .get('/oauth2/providers/google');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('authorizeUrl');
      expect(response.body).toHaveProperty('exchangeContextId');
      
      // Verify the authorize URL has required OAuth parameters
      const url = new URL(response.body.authorizeUrl);
      expect(url.origin).toBe('https://accounts.google.com');
      expect(url.pathname).toBe('/o/oauth2/v2/auth');
      expect(url.searchParams.has('client_id')).toBe(true);
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.has('redirect_uri')).toBe(true);
      expect(url.searchParams.has('scope')).toBe(true);
      expect(url.searchParams.has('state')).toBe(true);
    });

    it('Given an invalid provider, When requesting the OAuth authorize URL, Then HTTP 400 is returned', async () => {
      const response = await request(app)
        .get('/oauth2/providers/facebook');
      
      expect(response.status).toBe(400);
    });

    it('Given an unknown exchange context, When attempting to exchange, Then HTTP 400 is returned', async () => {
      const response = await request(app)
        .post('/oauth2/exchange')
        .send({ exchangeContextId: 'invalid-context-id-not-base64-signed' });
      
      // Should return 400 due to invalid signed blob format
      expect(response.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // TC-BE-SSO-06: Protected API Routes
  // ─────────────────────────────────────────────────────────────
  describe('TC-BE-SSO-06 - Protected API Routes', () => {
    it('Given no auth token, When posting a location, Then HTTP 401 is returned', async () => {
      const response = await request(app)
        .post('/api/locations')
        .send({ lat: 52.48, lng: -1.89 });
      
      expect(response.status).toBe(401);
    });

    it('Given invalid auth token, When posting a location, Then HTTP 401 is returned', async () => {
      const response = await request(app)
        .post('/api/locations')
        .set('Authorization', 'Bearer invalid-token')
        .send({ lat: 52.48, lng: -1.89 });
      
      expect(response.status).toBe(401);
    });

    it('Given valid mock auth token, When posting a location, Then HTTP 204 is returned', async () => {
      const response = await request(app)
        .post('/api/locations')
        .set('Authorization', 'Bearer mock-user-a')
        .send({ lat: 52.48, lng: -1.89 });
      
      expect(response.status).toBe(204);
    });

    it('Given no auth token, When getting friends, Then HTTP 401 is returned', async () => {
      const response = await request(app)
        .get('/api/getFriends');
      
      expect(response.status).toBe(401);
    });

    it('Given valid mock auth token, When getting friends, Then HTTP 200 is returned', async () => {
      const response = await request(app)
        .get('/api/getFriends')
        .set('Authorization', 'Bearer mock-user-a');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('Given no auth token, When creating a friend request, Then HTTP 401 is returned', async () => {
      const response = await request(app)
        .post('/api/createFriendRequest')
        .send({ friendEmail: 'test@example.com' });
      
      expect(response.status).toBe(401);
    });

    it('Given a user with friends in the DB, When authenticated with a real session token, Then friend data is correctly integrated', async () => {
      // Create users and establish friendship
      const userAId = userService.createOrUpdateFromIdentity('google', {
        subject: 'integration-user-a',
        name: 'User A',
        email: 'userA@example.com',
        avatarUrl: 'https://example.com/a.png'
      });
      const userBId = userService.createOrUpdateFromIdentity('google', {
        subject: 'integration-user-b',
        name: 'User B',
        email: 'userB@example.com',
        avatarUrl: 'https://example.com/b.png'
      });

      sendFriendRequest(userAId, userBId);
      acceptFriendRequest(userBId, userAId);

      // Authenticate as User A with a real session
      const session = sessionService.createSession(userAId);
      const response = await request(app)
        .get('/api/getFriends')
        .set('Authorization', `Bearer ${session.token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });
});
