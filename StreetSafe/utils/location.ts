export function getDistance(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;

  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function isUserOffRoute(userLocation: { latitude: number; longitude: number }, routePoints: { lat: number; lng: number }[]) {
  if (!routePoints || routePoints.length === 0) return false;

  const THRESHOLD = 50;
  let minDistance = Infinity;

  for (let point of routePoints) {
    const dist = getDistance(userLocation, {
      latitude: point.lat,
      longitude: point.lng,
    });

    if (dist < minDistance) minDistance = dist;
  }

  return minDistance > THRESHOLD;
}

export function checkInactivity(
  userLocation: { latitude: number; longitude: number },
  lastLocation: { latitude: number; longitude: number } | null,
  lastMoveTime: number
) {
  const MOVE_THRESHOLD = 5;
  const TIME_LIMIT = 2 * 60 * 1000;
  const now = Date.now();

  let newLastMoveTime = lastMoveTime;

  if (lastLocation) {
    const dist = getDistance(userLocation, lastLocation);

    if (dist > MOVE_THRESHOLD) {
      newLastMoveTime = now;
    }
  }

  const isInactive = now - newLastMoveTime > TIME_LIMIT;

  return { isInactive, lastMoveTime: newLastMoveTime, lastLocation: userLocation };
}
