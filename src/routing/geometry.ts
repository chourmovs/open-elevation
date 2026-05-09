import { bbox, bboxPolygon, center, distance, lineChunk, lineString, nearestPointOnLine, point, transformScale } from '@turf/turf';
import type { Feature, LineString } from '@turf/turf';
import type { MatchedSegment, OsmWay, OsrmRoute } from './types.js';

export function routeToLineString(route: OsrmRoute): Feature<LineString> {
  return route.geometry;
}

export function bufferedBbox(line: Feature<LineString>, bufferKm: number): [number, number, number, number] {
  const raw = bbox(line);
  const poly = bboxPolygon(raw);
  const scaled = transformScale(poly, 1 + bufferKm / Math.max(0.1, distance(point([raw[0], raw[1]]), point([raw[2], raw[3]]), { units: 'kilometers' })), { origin: 'center' });
  return bbox(scaled) as [number, number, number, number];
}

export function splitRouteIntoSegments(line: Feature<LineString>, segmentLengthMeters: number): Feature<LineString>[] {
  const segKm = segmentLengthMeters / 1000;
  return lineChunk(line, segKm, { units: 'kilometers' }).features;
}

export function distancePointToWay(pt: Feature<any>, way: OsmWay): number {
  const wayLine = lineString(way.geometry.map((g) => [g.lon, g.lat]));
  const snapped = nearestPointOnLine(wayLine, pt, { units: 'meters' });
  return snapped.properties.dist;
}

export function matchSegmentToNearestWay(segment: Feature<LineString>, ways: OsmWay[], radiusMeters = 35, segmentIndex = 0): MatchedSegment {
  const midpoint = center(segment);
  let best: OsmWay | null = null;
  let bestDist = Infinity;

  for (const way of ways) {
    const dist = distancePointToWay(midpoint, way);
    if (dist < bestDist) {
      bestDist = dist;
      best = way;
    }
  }

  const lengthMeters = distance(point(segment.geometry.coordinates[0]), point(segment.geometry.coordinates.at(-1)!), { units: 'meters' });

  return {
    segmentIndex,
    segment,
    midpoint,
    lengthMeters,
    matchedWay: bestDist <= radiusMeters ? best : null,
    distanceToWayMeters: Number.isFinite(bestDist) ? bestDist : null,
  };
}
