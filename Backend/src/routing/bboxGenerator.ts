import { bboxInterface, bboxQuery } from "./walkableFilter"

export type point = 
{
  lat: number;
  lng: number;
}

export function bboxFromPoints(points : point[]) : bboxInterface
{
  if (!points || points.length === 0) throw new Error("bboxFromPoints: empty points array");
 
  const lats = points.map(p => p.lat);
  const lngs = points.map(p => p.lng);

  const raw = {
  minLat: Math.min(...lats), maxLat: Math.max(...lats),
  minLng: Math.min(...lngs), maxLng: Math.max(...lngs),
  };

  const paddingMetres = 100;

  const midLat   = (raw.minLat + raw.maxLat) / 2;
  const latDelta = paddingMetres / 111_320;
  const lngDelta = paddingMetres / (111_320 * Math.cos((midLat * Math.PI) / 180));
  return {
    minLat: raw.minLat - latDelta, maxLat: raw.maxLat + latDelta,
    minLng: raw.minLng - lngDelta, maxLng: raw.maxLng + lngDelta,
  };
}

export function bboxFromPoint(point : point, radiusMetres : number)
{
  if (!point) throw new Error("bboxFromPoint: empty coordinates");

  const latDelta = radiusMetres / 111_320;
  const lngDelta = radiusMetres / (111_320 * Math.cos((point.lat * Math.PI) / 180));
  return {
    minLat: point.lat - latDelta, maxLat: point.lat + latDelta,
    minLng: point.lng - lngDelta, maxLng: point.lng + lngDelta,
  };
}