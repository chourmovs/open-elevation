import { describe, expect, it } from 'vitest';
import { parseMaxspeed, scoreRoadBikeRoute, scoreWayForRoadBike } from '../src/routing/roadBikeScoring.js';
import { lineString, point } from '@turf/turf';

describe('parseMaxspeed', () => {
  it('parses numeric and km/h formats', () => {
    expect(parseMaxspeed('90')).toBe(90);
    expect(parseMaxspeed('90 km/h')).toBe(90);
  });

  it('returns null for non numeric formats', () => {
    expect(parseMaxspeed('FR:urban')).toBeNull();
    expect(parseMaxspeed('signals')).toBeNull();
  });
});

describe('scoreWayForRoadBike', () => {
  it('rewards cycleway asphalt', () => {
    const s = scoreWayForRoadBike({ highway: 'cycleway', surface: 'asphalt', cycleway: 'lane', lanes: '2' });
    expect(s.score).toBeGreaterThan(160);
  });

  it('penalizes trunk fast road', () => {
    const s = scoreWayForRoadBike({ highway: 'trunk', maxspeed: '110', lanes: '3' });
    expect(s.score).toBeLessThan(0);
  });
});

describe('scoreRoadBikeRoute', () => {
  it('applies global penalties when risky road dominates', () => {
    const matched = Array.from({ length: 5 }).map((_, i) => ({
      segmentIndex: i,
      segment: lineString([[0,0],[0.001,0.001]]),
      lengthMeters: 100,
      midpoint: point([0.0005, 0.0005]),
      matchedWay: { id: i, nodes: [], geometry: [{lat:0,lon:0},{lat:0.001,lon:0.001}], tags: { highway: 'trunk', maxspeed: '110', surface: 'gravel' } },
      distanceToWayMeters: 2,
    }));
    const score = scoreRoadBikeRoute({ distanceMeters: 500, durationSeconds: 100 }, matched as any);
    expect(score.normalizedScore).toBeLessThan(-200);
    expect(score.penalties).toContain('global trunk/primary ratio');
  });
});
