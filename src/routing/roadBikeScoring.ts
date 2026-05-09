import type { MatchedSegment, RoadBikeScore } from './types.js';

export function parseMaxspeed(value?: string): number | null {
  if (!value) return null;
  const m = value.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

export function scoreWayForRoadBike(tags: Record<string, string>) {
  let score = 100;
  const penalties: string[] = [];
  const bonuses: string[] = [];
  const highway = tags.highway;
  const surface = tags.surface;
  const maxspeed = parseMaxspeed(tags.maxspeed);
  const lanes = tags.lanes ? Number(tags.lanes) : null;

  if (tags.bicycle === 'no') { score -= 1000; penalties.push('bicycle=no'); }
  if (tags.access === 'no' && tags.bicycle !== 'yes') { score -= 1000; penalties.push('access=no'); }
  if (highway === 'cycleway') { score += 45; bonuses.push('highway=cycleway'); }
  if (tags.cycleway || tags['cycleway:left'] || tags['cycleway:right']) { score += 30; bonuses.push('cycleway present'); }
  if (highway === 'tertiary') { score += 20; bonuses.push('highway=tertiary'); }
  if (highway === 'unclassified') { score += 15; bonuses.push('highway=unclassified'); }
  if (highway === 'trunk') { score -= 250; penalties.push('highway=trunk'); }
  if (highway === 'primary') { score -= 120; penalties.push('highway=primary'); }
  if (maxspeed !== null && maxspeed >= 90) { score -= 100; penalties.push('maxspeed>=90'); }
  else if (maxspeed !== null && maxspeed > 80) { score -= 60; penalties.push('maxspeed>80'); }
  else if (maxspeed !== null && maxspeed <= 30) { score -= 25; penalties.push('maxspeed<=30'); }
  if (surface === 'asphalt' || surface === 'paved') { score += 15; bonuses.push('surface=paved'); }
  if (surface === 'gravel') { score -= 120; penalties.push('surface=gravel'); }
  if (['unpaved', 'dirt', 'ground'].includes(surface ?? '')) { score -= 180; penalties.push('surface=unpaved'); }
  if (tags.shoulder === 'yes') { score += 10; bonuses.push('shoulder=yes'); }
  if (lanes !== null && lanes <= 2) { score += 5; bonuses.push('lanes<=2'); }
  if (lanes !== null && lanes >= 3) { score -= 80; penalties.push('lanes>=3'); }
  if ((highway === 'track' || highway === 'path') && !['asphalt', 'paved'].includes(surface ?? '') && tags.bicycle !== 'yes') {
    score -= 150; penalties.push('track/path unsuitable');
  }
  if (tags.tracktype) { score -= 30; penalties.push('tracktype present'); }

  return { score, penalties, bonuses, flags: { highway, surface, maxspeed, lanes } };
}

export function scoreRoadBikeRoute(route: { distanceMeters: number; durationSeconds: number }, matchedSegments: MatchedSegment[]): RoadBikeScore {
  const penalties = new Set<string>();
  const bonuses = new Set<string>();
  const stats = { cyclewayMeters: 0, primaryMeters: 0, trunkMeters: 0, highSpeedMeters: 0, lowSpeedMeters: 0, gravelMeters: 0, unknownMeters: 0, asphaltMeters: 0 };
  let weighted = 0;

  for (const seg of matchedSegments) {
    if (!seg.matchedWay) {
      stats.unknownMeters += seg.lengthMeters;
      weighted += 90 * seg.lengthMeters;
      penalties.add('unknown segment');
      continue;
    }
    const result = scoreWayForRoadBike(seg.matchedWay.tags);
    result.penalties.forEach((p) => penalties.add(p));
    result.bonuses.forEach((b) => bonuses.add(b));
    weighted += result.score * seg.lengthMeters;

    const t = seg.matchedWay.tags;
    if (t.highway === 'cycleway') stats.cyclewayMeters += seg.lengthMeters;
    if (t.highway === 'primary') stats.primaryMeters += seg.lengthMeters;
    if (t.highway === 'trunk') stats.trunkMeters += seg.lengthMeters;
    if (parseMaxspeed(t.maxspeed) !== null && parseMaxspeed(t.maxspeed)! >= 90) stats.highSpeedMeters += seg.lengthMeters;
    if (parseMaxspeed(t.maxspeed) !== null && parseMaxspeed(t.maxspeed)! <= 30) stats.lowSpeedMeters += seg.lengthMeters;
    if (['gravel', 'unpaved', 'dirt', 'ground', 'compacted'].includes(t.surface ?? '')) stats.gravelMeters += seg.lengthMeters;
    if (['asphalt', 'paved'].includes(t.surface ?? '')) stats.asphaltMeters += seg.lengthMeters;
  }

  const distance = Math.max(route.distanceMeters, 1);
  let normalized = weighted / distance;
  if (stats.highSpeedMeters / distance > 0.2) { normalized -= 150; penalties.add('global high-speed ratio'); }
  if (stats.gravelMeters / distance > 0.15) { normalized -= 250; penalties.add('global unpaved ratio'); }
  if ((stats.trunkMeters + stats.primaryMeters) / distance > 0.1) { normalized -= 200; penalties.add('global trunk/primary ratio'); }
  if (stats.lowSpeedMeters / distance > 0.35) { normalized -= 50; penalties.add('global low-speed ratio'); }

  return { totalScore: normalized * distance, normalizedScore: normalized, distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds, penalties: [...penalties], bonuses: [...bonuses], segmentStats: stats };
}
