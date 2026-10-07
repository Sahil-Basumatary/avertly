import pointToLineDistance from "@turf/point-to-line-distance";
import { lineString, point } from "@turf/helpers";

import type { Route } from "@/data/routes";
import type { Event } from "@/lib/events";

export const MAX_ROUTE_DISTANCE_KM = 500;
export const MAX_RESULTS = 20;

export const DISTANCE_THRESHOLDS = [
  { maxKm: 25, points: 30 },
  { maxKm: 100, points: 24 },
  { maxKm: 250, points: 15 },
  { maxKm: MAX_ROUTE_DISTANCE_KM, points: 6 },
] as const;

export const CATEGORY_POINTS: Record<Event["category"], number> = {
  security: 20,
  operations: 15,
  weather: 12,
};

export const RECENCY_THRESHOLDS = [
  { maxAgeDays: 1, points: 40 },
  { maxAgeDays: 3, points: 32 },
  { maxAgeDays: 7, points: 24 },
  { maxAgeDays: 14, points: 14 },
  { maxAgeDays: 30, points: 6 },
] as const;

export const LOCATION_PRECISION_POINTS: Record<
  Event["locationPrecision"],
  number
> = {
  exact: 10,
  nearby: 7,
  regional: 3,
  unknown: 0,
};

export const BAND_THRESHOLDS = {
  high: 80,
  elevated: 65,
} as const;

export type ExposureBand = "high" | "elevated" | "guarded";

export type ExposureAssessment = {
  eventId: Event["id"];
  score: number;
  band: ExposureBand;
  distanceKm: number;
  ageDays: number;
  breakdown: {
    distance: number;
    category: number;
    recency: number;
    locationPrecision: number;
  };
};

export type RankedEvent = {
  event: Event;
  assessment: ExposureAssessment;
};

export function getDistancePoints(distanceKm: number) {
  return (
    DISTANCE_THRESHOLDS.find(({ maxKm }) => distanceKm <= maxKm)?.points ?? 0
  );
}

export function getRecencyPoints(ageDays: number) {
  return (
    RECENCY_THRESHOLDS.find(({ maxAgeDays }) => ageDays <= maxAgeDays)?.points ??
    0
  );
}

export function getExposureBand(score: number): ExposureBand {
  if (score >= BAND_THRESHOLDS.high) {
    return "high";
  }

  if (score >= BAND_THRESHOLDS.elevated) {
    return "elevated";
  }

  return "guarded";
}

export function scoreEvent(
  event: Event,
  route: Route,
  referenceAt: string,
): ExposureAssessment | null {
  const distanceKm = pointToLineDistance(
    point(event.coordinates),
    lineString(route.coordinates),
    { units: "kilometers" },
  );

  if (distanceKm > MAX_ROUTE_DISTANCE_KM) {
    return null;
  }

  const ageDays = Math.max(
    0,
    (Date.parse(referenceAt) - Date.parse(event.publishedAt)) /
      (24 * 60 * 60 * 1000),
  );
  const breakdown = {
    distance: getDistancePoints(distanceKm),
    category: CATEGORY_POINTS[event.category],
    recency: getRecencyPoints(ageDays),
    locationPrecision: LOCATION_PRECISION_POINTS[event.locationPrecision],
  };
  const score = Math.min(
    100,
    Math.max(0, Object.values(breakdown).reduce((sum, value) => sum + value, 0)),
  );

  return {
    eventId: event.id,
    score,
    band: getExposureBand(score),
    distanceKm,
    ageDays,
    breakdown,
  };
}

export function rankEventsByExposure(
  events: Event[],
  route: Route,
  referenceAt: string,
): RankedEvent[] {
  return events
    .map((event) => {
      const assessment = scoreEvent(event, route, referenceAt);
      return assessment ? { event, assessment } : null;
    })
    .filter((entry): entry is RankedEvent => entry !== null)
    .sort(
      (left, right) =>
        right.assessment.score - left.assessment.score ||
        left.assessment.distanceKm - right.assessment.distanceKm ||
        left.event.id.localeCompare(right.event.id),
    )
    .slice(0, MAX_RESULTS);
}
