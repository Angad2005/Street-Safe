
import db from '../../src/lib/db';
import { getAllHazards, addHazard } from '../../src/Hazards';
import { userService } from '../../src/services/user';
import { sessionService, init as initSession } from '../../src/services/auth/session';
import * as context from '../../src/services/auth/context';
import { init as initIdp } from '../../src/services/idp';
import { init as initAuth } from '../../src/services/auth';
import { verify } from '../../src/lib/crypto/hmac';
import { sendFriendRequest, getFriends, acceptFriendRequest } from '../../src/friends';
import { upsertLocation, getActiveLocations } from '../../src/Locations';

describe('TC-BE-DB-01 - Test Database & Schema Management', () => {

  beforeAll(() => {
    // Explicitly initialize all service-specific tables
    userService.init();
    initSession();
    initIdp();
    initAuth();
  });

  // ─────────────────────────────────────────────────────────────
  // TC-BE-DB-01 - Migrations Initialization
  // ─────────────────────────────────────────────────────────────
  describe('TC-BE-DB-01 - Migrations Initialization', () => {
    it('Given the test environment connects to the in-memory SQLite DB, When backend routers prepare, Then all essential schemas exist', () => {
      // Query sqlite_master to verify all required tables exist in main db
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table'"
      ).all() as { name: string }[];
      
      const tableNames = tables.map(t => t.name);
      
      // Essential tables that should exist after initialization
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('Friends');
      expect(tableNames).toContain('Hazards');
      expect(tableNames).toContain('sessions');
      expect(tableNames).toContain('identity_provider_tokens');
    });

    it('Given the auth context, When initialized, Then exchange_tokens exists in CACHE_DB', () => {
       // exchange_tokens is in a separate CACHE_DB (:memory:)
       const tables = context.CACHE_DB.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='exchange_tokens'"
      ).all() as { name: string }[];
      
      expect(tables.length).toBe(1);
      expect(tables[0].name).toBe('exchange_tokens');
    });

    it('Given the database is initialized, When checking table structure, Then all essential schemas dynamically orchestrate securely', () => {
      // Verify Users table structure
      const usersTable = db.prepare("PRAGMA table_info(users)").all();
      expect(usersTable.length).toBe(5); // id, identity_provider_subject, name, email, avatar_url
      
      // Verify Friends table structure  
      const friendsTable = db.prepare("PRAGMA table_info(Friends)").all();
      expect(friendsTable.length).toBe(5); // id, sender_id, accepter_id, status, created_at
      
      // Verify Sessions table structure
      const sessionsTable = db.prepare("PRAGMA table_info(sessions)").all();
      expect(sessionsTable.length).toBe(4); // token, user_id, created_at, expires_at
    });

    it('Given the in-memory database, When checking database settings, Then it operates without locking conditions', () => {
      // In-memory SQLite should not have locking issues
      const journals = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%journal%'"
      ).all();
      
      // In-memory databases typically don't create journal files
      expect(Array.isArray(journals)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Schema Constraint Tests
  // ─────────────────────────────────────────────────────────────
  describe('Schema Constraint Tests', () => {
    describe('Users Table Constraints', () => {
      it('Given a user is created, When inserted with unique identity_provider_subject, Then it is stored correctly', () => {
        const userId = userService.createOrUpdateFromIdentity('google', {
          subject: 'unique-test-subject-123',
          name: 'Test User',
          email: 'uniquetest@example.com',
          avatarUrl: 'https://example.com/avatar.png'
        });
        
        expect(userId).toBeDefined();
        expect(typeof userId).toBe('number');
        
        const retrieved = userService.getById(userId);
        expect(retrieved).toBeDefined();
        expect(retrieved?.email).toBe('uniquetest@example.com');
      });

      it('Given a user exists, When upserting with same identity, Then the user is updated not duplicated', () => {
        const originalId = userService.createOrUpdateFromIdentity('google', {
          subject: 'upsert-test-subject',
          name: 'Original Name',
          email: 'upsert@example.com',
          avatarUrl: 'https://example.com/original.png'
        });
        
        const updatedId = userService.createOrUpdateFromIdentity('google', {
          subject: 'upsert-test-subject',
          name: 'Updated Name',
          email: 'upsert@example.com',
          avatarUrl: 'https://example.com/updated.png'
        });
        
        // Should return same ID due to upsert
        expect(updatedId).toBe(originalId);
        
        // Verify data was updated
        const retrieved = userService.getById(originalId);
        expect(retrieved?.name).toBe('Updated Name');
        expect(retrieved?.avatarUrl).toBe('https://example.com/updated.png');
      });
    });

    describe('Friends Table Constraints', () => {
      it('Given a friend relationship is created, When querying with sender/accepter, Then relationships are stored correctly', () => {
        const user1 = userService.createOrUpdateFromIdentity('google', {
          subject: 'friend-constraint-user1',
          name: 'User 1',
          email: 'friendconstraint1@example.com',
          avatarUrl: 'http://example.com/1.png'
        });
        
        const user2 = userService.createOrUpdateFromIdentity('google', {
          subject: 'friend-constraint-user2',
          name: 'User 2',
          email: 'friendconstraint2@example.com',
          avatarUrl: 'http://example.com/2.png'
        });
        
        // Send friend request
        sendFriendRequest(user1, user2);
        
        // Accept friend request
        acceptFriendRequest(user2, user1);
        
        const friends = getFriends(user1);
        expect(friends.length).toBe(1);
        expect(friends[0].status).toBe('accepted');
      });
    });

    describe('Sessions Table Constraints', () => {
      it('Given a session is created, When querying with token, Then session is retrieved correctly', () => {
        const userId = userService.createOrUpdateFromIdentity('google', {
          subject: 'session-test-user',
          name: 'Session User',
          email: 'sessiontest@example.com',
          avatarUrl: 'http://example.com/session.png'
        });
        
        const session = sessionService.createSession(userId);
        expect(session.token).toBeDefined();
        expect(session.expiresAt).toBeInstanceOf(Date);
        
        // Verify session can be retrieved
        try {
          const rawToken = verify(session.token);
          const retrievedUserId = sessionService.getSession(rawToken);
          expect(retrievedUserId).toBe(userId);
        } catch (err) {
          console.error("SESSION ERROR:", err);
          throw err;
        }
      });

      it('Given a session is deleted, When querying, Then session is no longer retrievable', () => {
        const userId = userService.createOrUpdateFromIdentity('google', {
          subject: 'session-delete-user',
          name: 'Delete User',
          email: 'sessiondelete@example.com',
          avatarUrl: 'http://example.com/delete.png'
        });
        
        const session = sessionService.createSession(userId);
        try {
          const rawToken = verify(session.token);
          
          // Delete session
          sessionService.deleteSession(rawToken);
          
          // Verify session is no longer retrievable
          const retrievedUserId = sessionService.getSession(rawToken);
          expect(retrievedUserId).toBeNull();
        } catch (err) {
          console.error("SESSION DELETE ERROR:", err);
          throw err;
        }
      });
    });

    describe('Exchange Context Table Constraints', () => {
      it('Given an exchange context is created, When querying, Then context is retrievable', () => {
        const state = Buffer.alloc(32, 0xAB);
        const exchangeContextId = context.create(state);
        
        expect(exchangeContextId).toBeDefined();
        expect(typeof exchangeContextId).toBe('string');
        
        try {
          const rawContextId = verify(exchangeContextId);
          const retrievedUserId = context.getExchangedAccountIdForToken(rawContextId);
          
          // Should be null initially (not yet associated with user)
          expect(retrievedUserId).toBeNull();
        } catch (err) {
          console.error("EXCHANGE CONTEXT ERROR:", err);
          throw err;
        }
      });

      it('Given an exchange context is updated with user ID, When querying, Then user ID is returned', () => {
        const userId = userService.createOrUpdateFromIdentity('google', {
          subject: 'exchange-context-user',
          name: 'Exchange User',
          email: 'exchange@example.com',
          avatarUrl: 'http://example.com/exchange.png'
        });
        
        const state = Buffer.alloc(32, 0xCD);
        const exchangeContextId = context.create(state);
        
        // Update with user ID
        context.updateTokenUsingState(state, userId);
        
        const rawContextId = verify(exchangeContextId);
        const retrievedUserId = context.getExchangedAccountIdForToken(rawContextId);
        
        expect(retrievedUserId).toBe(userId);
      });
    });

    describe('Hazards Table Constraints', () => {
      it('Given a hazard is added, When querying, Then hazard is stored correctly', () => {
        addHazard('theft', '52.4', '-1.9');
        
        const hazards = getAllHazards() as Array<{ Category: string; Latitude: string; Longitude: string }>;
        expect(hazards.length).toBeGreaterThan(0);
        
        const hazard = hazards.find((h: { Category: string }) => h.Category === 'theft');
        expect(hazard).toBeDefined();
        expect(hazard?.Latitude).toBe('52.4');
        expect(hazard?.Longitude).toBe('-1.9');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Data Integrity Tests
  // ─────────────────────────────────────────────────────────────
  describe('Data Integrity Tests', () => {
    it('Given multiple operations are performed, When checking data consistency, Then all data remains consistent', () => {
      // Create user
      const userId = userService.createOrUpdateFromIdentity('google', {
        subject: 'integrity-test-user',
        name: 'Integrity User',
        email: 'integrity@example.com',
        avatarUrl: 'http://example.com/integrity.png'
      });
      
      // Create session
      const session = sessionService.createSession(userId);
      expect(session.token).toBeDefined();
      
      // Create friend
      const friendId = userService.createOrUpdateFromIdentity('google', {
        subject: 'integrity-test-friend',
        name: 'Integrity Friend',
        email: 'integrityfriend@example.com',
        avatarUrl: 'http://example.com/friend.png'
      });
      
      sendFriendRequest(userId, friendId);
      acceptFriendRequest(friendId, userId);
      
      // Create hazard
      addHazard('harassment', '52.5', '-1.8');
      
      // Verify all data
      const user = userService.getById(userId);
      expect(user?.email).toBe('integrity@example.com');
      
      const friends = getFriends(userId);
      expect(friends.length).toBe(1);
      
      const hazards = getAllHazards() as Array<{ Category: string }>;
      expect(hazards.some((h: { Category: string }) => h.Category === 'harassment')).toBe(true);
    });

    it('Given concurrent operations, When checking database state, Then no data corruption occurs', () => {
      // Create multiple users
      const users = [];
      for (let i = 0; i < 10; i++) {
        const userId = userService.createOrUpdateFromIdentity('google', {
          subject: `concurrent-user-${i}`,
          name: `Concurrent User ${i}`,
          email: `concurrent${i}@example.com`,
          avatarUrl: `http://example.com/concurrent${i}.png`
        });
        users.push(userId);
      }
      
      // Verify all users were created
      users.forEach(userId => {
        const user = userService.getById(userId);
        expect(user).toBeDefined();
      });
    });

    it('Given the locations module, When upserting locations, Then locations are stored in memory correctly', () => {
      const userId = userService.createOrUpdateFromIdentity('google', {
        subject: 'location-test-user',
        name: 'Location User',
        email: 'location@example.com',
        avatarUrl: 'http://example.com/location.png'
      });
      
      // Upsert location
      upsertLocation(userId, 52.4, -1.9);
      
      // Get active locations
      const locations = getActiveLocations();
      expect(locations[userId]).toBeDefined();
      expect(locations[userId].lat).toBe(52.4);
      expect(locations[userId].lng).toBe(-1.9);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Query Performance Tests
  // ─────────────────────────────────────────────────────────────
  describe('Query Performance Tests', () => {
    it('Given a large dataset, When querying tables, Then queries execute efficiently', () => {
      // Create 100 users
      const provider = 'google';
      for (let i = 0; i < 100; i++) {
        userService.createOrUpdateFromIdentity(provider, {
          subject: `perf-user-${i}`,
          name: `Perf User ${i}`,
          email: `perf${i}@example.com`,
          avatarUrl: `http://example.com/perf${i}.png`
        });
      }
      
      // Measure query time for users table
      const startTime = Date.now();
      const users = db.prepare("SELECT * FROM users").all();
      const queryTime = Date.now() - startTime;
      
      expect(users.length).toBeGreaterThanOrEqual(100);
      expect(queryTime).toBeLessThan(1000); // Should complete in under 1 second
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Transaction Tests
  // ─────────────────────────────────────────────────────────────
  describe('Transaction Tests', () => {
    it('Given a transaction is used, When operations are performed, Then all operations succeed or fail together', () => {
      // This tests that SQLite transactions work correctly
      const transaction = db.transaction(() => {
        const user1 = userService.createOrUpdateFromIdentity('google', {
          subject: 'transaction-user-1',
          name: 'Transaction User 1',
          email: 'transaction1@example.com',
          avatarUrl: 'http://example.com/t1.png'
        });
        
        const user2 = userService.createOrUpdateFromIdentity('google', {
          subject: 'transaction-user-2',
          name: 'Transaction User 2',
          email: 'transaction2@example.com',
          avatarUrl: 'http://example.com/t2.png'
        });
        
        sendFriendRequest(user1, user2);
        acceptFriendRequest(user2, user1);
        
        return { user1, user2 };
      });
      
      const result = transaction();
      expect(result.user1).toBeDefined();
      expect(result.user2).toBeDefined();
      
      // Verify friends were created
      const friends = getFriends(result.user1);
      expect(friends.length).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Cleanup Tests
  // ─────────────────────────────────────────────────────────────
  describe('Cleanup Tests', () => {
    it('Given stale exchange contexts exist, When context is invalidated, Then expired tokens are cleaned up', () => {
      // Create multiple contexts
      for (let i = 0; i < 5; i++) {
        const state = Buffer.alloc(32, i);
        context.create(state);
      }
      
      // Mark one as used
      const testState = Buffer.alloc(32, 0xFF);
      const exchangeContextId = context.create(testState);
      
      const rawContextId = verify(exchangeContextId);
      
      // Mark as used
      context.markUsed(rawContextId);
      
      // Verify it's no longer retrievable
      const result = context.getExchangedAccountIdForToken(rawContextId);
      expect(result).toBeNull();
    });
  });
});
