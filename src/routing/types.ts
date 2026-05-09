import type { Feature, LineString } from '@turf/turf';

export type Coordinate = { lat: number; lon: number };

export type OsrmRoute = {
  id: string;
  geometry: Feature<LineString>;
  distanceMeters: number;
  durationSeconds: number;
  weight?: number;
  annotations?: {
    distance?: number[];
    duration?: number[];
    speed?: number[];
    nodes?: number[];
  };
};

export type OsmWay = {
  id: number;
  nodes: number[];
  geometry: Array<{ lat: number; lon: number }>;
  tags: Record<string, string>;
};

export type MatchedSegment = {
  segmentIndex: number;
  segment: Feature<LineString>;
  lengthMeters: number;
  midpoint: Feature<any>;
  matchedWay: OsmWay | null;
  distanceToWayMeters: number | null;
};

export type RoadBikeScore = {
  totalScore: number;
  normalizedScore: number;
  distanceMeters: number;
  durationSeconds: number;
  penalties: string[];
  bonuses: string[];
  segmentStats: {
    cyclewayMeters: number;
    primaryMeters: number;
    trunkMeters: number;
    highSpeedMeters: number;
    lowSpeedMeters: number;
    gravelMeters: number;
    unknownMeters: number;
    asphaltMeters: number;
  };
};

export type RoadBikeOptions = {
  avoidHighSpeed?: boolean;
  avoidLowSpeedUrban?: boolean;
  preferCycleways?: boolean;
  avoidUnpaved?: boolean;
  bboxBufferKm?: number;
  segmentLengthMeters?: number;
  matchRadiusMeters?: number;
  allowFallback?: boolean;
};
