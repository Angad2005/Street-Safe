import { point } from "./bboxGenerator"
import { Edge } from "./Pathfinding"

type SnapResult =
{
  snapped: point;
  edge: Edge;
  t: number;
  distance: number;
};

function distanceMetres(a: point, b: point): number 
{
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const mLat = dLat * R;
  const mLng = dLng * R * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.sqrt(mLat * mLat + mLng * mLng);
}

// Project point P onto segment AB; returns t ∈ [0,1] and the closest point
function projectOntoSegment(
  p: point,
  a: point,
  b: point
): { t: number; closest: point }
{
  // Work in a flat (metre) space centred on A
  const cosLat = Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  const R = 6_371_000;

  const toM = (from: point, to: point) => ({
    x: (to.lng - from.lng) * (Math.PI / 180) * R * cosLat,
    y: (to.lat - from.lat) * (Math.PI / 180) * R,
  });

  const ab = toM(a, b);
  const ap = toM(a, p);

  const len2 = ab.x * ab.x + ab.y * ab.y;

  if (len2 === 0) return { t: 0, closest: a };

  const t = Math.max(0, Math.min(1, (ap.x * ab.x + ap.y * ab.y) / len2));

  const closest: point = {
    lat: a.lat + t * (b.lat - a.lat),
    lng: a.lng + t * (b.lng - a.lng),
  };

  return { t, closest };
}

export function snapToNearestEdge(position: point, edges: Edge[]): SnapResult | null
{
  if (edges.length === 0) return null;

  console.log('First edge ptA:', edges[0].ptA);
  console.log('First edge ptB:', edges[0].ptB);
  console.log('Position:', position);

  let best: SnapResult | null = null;

  console.log('Edge count:', edges.length);

  for (const edge of edges)
  {

    if (!edge.ptA || !edge.ptB)
      {
      console.warn('Edge missing ptA or ptB:', edge);
      continue;
    }
    
    if (isNaN(edge.ptA.lat) || isNaN(edge.ptA.lng) || 
        isNaN(edge.ptB.lat) || isNaN(edge.ptB.lng)) {
      console.warn('Edge has NaN coordinates:', edge);
      continue;
    }

    const { t, closest } = projectOntoSegment(position, edge.ptA, edge.ptB);
    const distance = distanceMetres(position, closest);

    if (best === null || distance < best.distance) {
      best = { snapped: closest, edge, t, distance };
    }
  }

  console.log('Snapping position:', position);
  return best;
}