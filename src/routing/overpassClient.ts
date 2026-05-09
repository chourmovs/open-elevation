import type { OsmWay } from './types.js';

const overpassCache = new Map<string, OsmWay[]>();

type Bbox = [number, number, number, number];

function keyForBbox([minLon, minLat, maxLon, maxLat]: Bbox): string {
  return [minLon, minLat, maxLon, maxLat].map((v) => v.toFixed(4)).join(',');
}

function buildQuery([minLon, minLat, maxLon, maxLat]: Bbox): string {
  return `[out:json][timeout:25];
(
  way["highway"](${minLat},${minLon},${maxLat},${maxLon});
  way["cycleway"](${minLat},${minLon},${maxLat},${maxLon});
);
out geom tags;`;
}

async function fetchOverpass(query: string, timeoutMs = 25000): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchWaysForBbox(bbox: Bbox): Promise<OsmWay[]> {
  const key = keyForBbox(bbox);
  const cached = overpassCache.get(key);
  if (cached) return cached;

  const query = buildQuery(bbox);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const data = await fetchOverpass(query);
      const ways: OsmWay[] = (data.elements ?? [])
        .filter((el: any) => el.type === 'way' && Array.isArray(el.geometry))
        .map((el: any) => ({
          id: el.id,
          nodes: el.nodes ?? [],
          geometry: el.geometry.map((g: any) => ({ lat: g.lat, lon: g.lon })),
          tags: el.tags ?? {},
        }));
      overpassCache.set(key, ways);
      return ways;
    } catch (err) {
      lastErr = err;
    }
  }

  throw new Error(`Overpass unavailable after retry: ${String(lastErr)}`);
}

// TODO(PostGIS): replace bbox + Overpass pull with indexed nearest-way queries on local PostGIS tables.
