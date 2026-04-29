import { describe, it, expect, beforeAll } from 'vitest';
import { userService } from '../../src/services/user';
import { init as initIdp } from '../../src/services/idp';
import { init as initSession, sessionService } from '../../src/services/auth/session';
import { sendFriendRequest, acceptFriendRequest, getFriends } from '../../src/friends';
import { upsertLocation, getActiveLocations } from '../../src/Locations';
import { addHazard, getAllHazards } from '../../src/Hazards';
import { verify } from '../../src/lib/crypto/hmac';
import db from '../../src/lib/db';

describe('Module Flow Integration Tests', () => {
  beforeAll(() => {
    userService.init();
    initIdp();
    initSession();
  });

  it('TC-INT-LOC-01 - Given two users are friends, When User A share location, Then User B should see it', () => {
    // 1. Ensure users exist
    const userA = userService.createOrUpdateFromIdentity('google', {
      subject: 'flow-user-a',
      name: 'User A',
      email: 'a@example.com',
      avatarUrl: 'url_a'
    });
    const userB = userService.createOrUpdateFromIdentity('google', {
      subject: 'flow-user-b',
      name: 'User B',
      email: 'b@example.com',
      avatarUrl: 'url_b'
    });

    // 2. Establish friendship
    sendFriendRequest(userA, userB);
    acceptFriendRequest(userB, userA);

    // 3. Update location
    upsertLocation(userA, 52.4862, -1.8904);

    // 4. Verify in active locations
    const locations = getActiveLocations();
    expect(locations[userA]).toBeDefined();
    expect(locations[userA].lat).toBe(52.4862);
  });

  it('TC-INT-FRI-01 - Given a friend request is sent and accepted, Then friendship is establish in DB', () => {
    const userC = userService.createOrUpdateFromIdentity('google', {
      subject: 'flow-user-c',
      name: 'User C',
      email: 'c@example.com',
      avatarUrl: 'url_c'
    });
    const userD = userService.createOrUpdateFromIdentity('google', {
      subject: 'flow-user-d',
      name: 'User D',
      email: 'd@example.com',
      avatarUrl: 'url_d'
    });

    sendFriendRequest(userC, userD);
    acceptFriendRequest(userD, userC);

    const friendsCount = getFriends(userC).length;
    expect(friendsCount).toBeGreaterThanOrEqual(1);
  });

  it('TC-INT-HAZ-01 - Given a hazard is reported, Then it is stored in the database correctly', () => {
    const initialHazards = getAllHazards();
    addHazard('high_crime', '52.4862', '-1.8904');
    const newHazards = getAllHazards();
    expect(newHazards.some(h => h.Category === 'high_crime')).toBe(true);
  });

  it('TC-INT-AUTH-01 - Given a session is created, When verified, Then it returns the correct user ID', () => {
    const userE = userService.createOrUpdateFromIdentity('google', {
      subject: 'flow-user-e',
      name: 'User E',
      email: 'e@example.com',
      avatarUrl: 'url_e'
    });

    const { token } = sessionService.createSession(userE);
    const retrievedUserId = sessionService.getSession(verify(token));
    expect(retrievedUserId).toBe(userE);
  });
});
