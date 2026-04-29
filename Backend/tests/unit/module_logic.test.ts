import { describe, it, expect } from 'vitest';
import { getAllHazards, addHazard } from '../../src/Hazards';
import { getFriends } from '../../src/friends';
import { upsertLocation, getActiveLocations } from '../../src/Locations';

describe('Module Logic Unit Tests', () => {
  describe('Hazards Logic', () => {
    it('TC-BE-HAZ-01 - Given a new hazard, When added, Then it is retrievable via getAllHazards', () => {
      const initialHazards = getAllHazards();
      addHazard('closure', '52.4870', '-1.8880');
      const newHazards = getAllHazards();
      expect(newHazards.length).toBeGreaterThan(initialHazards.length);
      expect(newHazards.some((h: any) => h.Category === 'closure')).toBe(true);
    });
  });

  describe('Friends Logic', () => {
    it('TC-BE-FRI-01 - Given a user ID, When getFriends is called, Then it returns an array', () => {
      const friends = getFriends(1);
      expect(Array.isArray(friends)).toBe(true);
    });
  });
});
