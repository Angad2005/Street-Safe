import { getDistance, isUserOffRoute, checkInactivity } from '../location';

describe('Location Utility Tests', () => {
  describe('getDistance', () => {
    it('TC-UTIL-01 - Given two coordinates, When getDistance is called, Then it returns the correct distance in meters', () => {
      const birmingham = { latitude: 52.4862, longitude: -1.8904 };
      const london = { latitude: 51.5074, longitude: -0.1278 };
      
      const dist = getDistance(birmingham, london);
      // Distance between Birmingham and London is approx 160km
      expect(dist).toBeGreaterThan(160000);
      expect(dist).toBeLessThan(170000);
    });

    it('TC-UTIL-01 - Given same coordinates, When getDistance is called, Then it returns 0', () => {
      const loc = { latitude: 52.4862, longitude: -1.8904 };
      expect(getDistance(loc, loc)).toBe(0);
    });
  });

  describe('isUserOffRoute', () => {
    const routePoints = [
      { lat: 52.4862, lng: -1.8904 },
      { lat: 52.4895, lng: -1.8865 }
    ];

    it('TC-UTIL-02 - Given a user near a route point, When isUserOffRoute is called, Then it returns false', () => {
      const nearPoint = { latitude: 52.48621, longitude: -1.89041 };
      expect(isUserOffRoute(nearPoint, routePoints)).toBe(false);
    });

    it('TC-UTIL-02 - Given a user far from route points, When isUserOffRoute is called, Then it returns true', () => {
      const farPoint = { latitude: 53.0, longitude: -2.0 };
      expect(isUserOffRoute(farPoint, routePoints)).toBe(true);
    });
  });

  describe('checkInactivity', () => {
    const startLoc = { latitude: 52.4862, longitude: -1.8904 };

    it('TC-UTIL-03 - Given the user has not moved for > 2 mins, When checkInactivity is called, Then it flags inactivity', () => {
      const sameLoc = { latitude: 52.4862, longitude: -1.8904 };
      const lastMoveTime = Date.now() - (3 * 60 * 1000); // 3 mins ago

      const result = checkInactivity(sameLoc, startLoc, lastMoveTime);
      expect(result.isInactive).toBe(true);
    });

    it('TC-UTIL-03 - Given the user just moved, When checkInactivity is called, Then it does not flag inactivity', () => {
      const moveLoc = { latitude: 52.5, longitude: -1.9 };
      const lastMoveTime = Date.now() - (10 * 1000); // 10 seconds ago

      const result = checkInactivity(moveLoc, startLoc, lastMoveTime);
      expect(result.isInactive).toBe(false);
    });
  });
});
