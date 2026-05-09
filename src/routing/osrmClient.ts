import { lineString } from '@turf/turf';
import type { Coordinate, OsrmRoute } from './types.js';

export type GetOsrmRoutesInput = {
  start: Coordinate;
  end: Coordinate;
  profile?: string;
  alternatives?: boolean;
};

export async function getOsrmRoutes(input: GetOsrmRoutesInput): Promise<OsrmRoute[]> {
  const profile = input.profile ?? 'bicycle';
  const alternatives = input.alternatives ?? true;
  const coords = `${input.start.lon},${input.start.lat};${input.end.lon},${input.end.lat}`;
  const url = `http://localhost:5000/route/v1/${profile}/${coords}?overview=full&geometries=geojson&alternatives=${alternatives}&annotations=true`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM error: ${res.status} ${res.statusText}`);

  const json = await res.json() as any;
  if (json.code !== 'Ok' || !Array.isArray(json.routes)) {
    throw new Error(`OSRM response invalid: ${json.code ?? 'unknown'}`);
  }

  return json.routes.map((route: any, idx: number) => ({
    id: `osrm-${idx}`,
    geometry: lineString(route.geometry.coordinates),
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    weight: route.weight,
    annotations: route.legs?.[0]?.annotation,
  }));
}
