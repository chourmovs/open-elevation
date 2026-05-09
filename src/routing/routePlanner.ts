import { bufferedBbox, matchSegmentToNearestWay, routeToLineString, splitRouteIntoSegments } from './geometry.js';
import { fetchWaysForBbox } from './overpassClient.js';
import { getOsrmRoutes } from './osrmClient.js';
import { scoreRoadBikeRoute } from './roadBikeScoring.js';
import type { Coordinate, RoadBikeOptions } from './types.js';

export async function planRoadBikeRoute(input: { start: Coordinate; end: Coordinate; options?: RoadBikeOptions }) {
  const options = input.options ?? {};
  const segmentLengthMeters = options.segmentLengthMeters ?? 80;
  const bboxBufferKm = options.bboxBufferKm ?? 0.3;
  const matchRadiusMeters = options.matchRadiusMeters ?? 35;

  const routes = await getOsrmRoutes({ start: input.start, end: input.end, alternatives: true, profile: 'bicycle' });
  const scored = [] as any[];
  let overpassWayCount = 0;
  let matchedSegmentCount = 0;
  let unmatchedSegmentCount = 0;

  for (const route of routes) {
    const line = routeToLineString(route);
    const bbox = bufferedBbox(line, bboxBufferKm);
    let ways = [];
    try {
      ways = await fetchWaysForBbox(bbox);
      overpassWayCount += ways.length;
    } catch (e) {
      if (options.allowFallback) {
        ways = [];
      } else {
        throw e;
      }
    }

    const segments = splitRouteIntoSegments(line, segmentLengthMeters);
    const matched = segments.map((seg, i) => matchSegmentToNearestWay(seg, ways, matchRadiusMeters, i));
    matchedSegmentCount += matched.filter((s) => s.matchedWay).length;
    unmatchedSegmentCount += matched.filter((s) => !s.matchedWay).length;

    const score = scoreRoadBikeRoute(route, matched);
    scored.push({ geometry: line.geometry, distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds, score });
  }

  scored.sort((a, b) => b.score.normalizedScore - a.score.normalizedScore);

  return {
    bestRoute: scored[0],
    alternatives: scored.slice(1),
    diagnostics: { osrmRouteCount: routes.length, overpassWayCount, matchedSegmentCount, unmatchedSegmentCount },
  };
}
