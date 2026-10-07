import { describe, expect, it } from "vitest";

import {
  events as replayEvents,
  REPLAY_SNAPSHOT_AT,
} from "@/data/replay-events";
import { routes, type Route } from "@/data/routes";
import type { Event } from "@/lib/events";
import {
  getDistancePoints,
  MAX_RESULTS,
  rankEventsByExposure,
  scoreEvent,
} from "@/lib/exposure";

const referenceAt = "2026-10-06T12:00:00.000Z";
const testRoute: Route = {
  id: "suez",
  name: "Test route",
  shortName: "Test",
  description: "Equatorial test route",
  countryCodes: [],
  coordinates: [
    [0, 0],
    [10, 0],
  ],
};

function eventFixture(overrides: Partial<Event> = {}): Event {
  return {
    id: "test-event",
    title: "Test public report",
    summary: "A public report used to verify deterministic exposure scoring.",
    sourceName: "Test source",
    sourceUrl: "https://example.com/report",
    publishedAt: referenceAt,
    timePrecision: "minute",
    coordinates: [5, 0],
    locationName: "Test location",
    locationNote: "Exact test coordinate.",
    locationPrecision: "exact",
    category: "security",
    mode: "live",
    ...overrides,
  };
}

describe("distance scoring", () => {
  it.each([
    [0, 30],
    [25, 30],
    [25.01, 24],
    [100, 24],
    [100.01, 15],
    [250, 15],
    [250.01, 6],
    [500, 6],
    [500.01, 0],
  ])("awards %s km the expected points", (distanceKm, points) => {
    expect(getDistancePoints(distanceKm)).toBe(points);
  });

  it("keeps events within 500 km and drops events beyond it", () => {
    const withinCutoff = scoreEvent(
      eventFixture({ coordinates: [5, 4.49] }),
      testRoute,
      referenceAt,
    );
    const beyondCutoff = scoreEvent(
      eventFixture({ coordinates: [5, 4.51] }),
      testRoute,
      referenceAt,
    );

    expect(withinCutoff?.distanceKm).toBeLessThanOrEqual(500);
    expect(beyondCutoff).toBeNull();
  });
});

describe("exposure ranking", () => {
  it("orders by score, then distance, then event ID", () => {
    const ranked = rankEventsByExposure(
      [
        eventFixture({
          id: "tie-far",
          coordinates: [5, 0.2],
          category: "operations",
          locationPrecision: "nearby",
        }),
        eventFixture({
          id: "z-exact-tie",
          coordinates: [5, 0.15],
          category: "operations",
          locationPrecision: "nearby",
        }),
        eventFixture({ id: "score-first" }),
        eventFixture({
          id: "tie-short",
          coordinates: [5, 0.1],
          category: "operations",
          locationPrecision: "nearby",
        }),
        eventFixture({
          id: "a-exact-tie",
          coordinates: [5, 0.15],
          category: "operations",
          locationPrecision: "nearby",
        }),
      ],
      testRoute,
      referenceAt,
    );

    expect(ranked.map(({ event }) => event.id)).toEqual([
      "score-first",
      "tie-short",
      "a-exact-tie",
      "z-exact-tie",
      "tie-far",
    ]);
  });

  it("returns no more than the top 20 events", () => {
    const events = Array.from({ length: MAX_RESULTS + 5 }, (_, index) =>
      eventFixture({ id: `event-${String(index).padStart(2, "0")}` }),
    );

    expect(rankEventsByExposure(events, testRoute, referenceAt)).toHaveLength(
      MAX_RESULTS,
    );
  });

  it("keeps every score within 0–100", () => {
    const events = [
      eventFixture({ id: "maximum" }),
      eventFixture({
        id: "lower",
        category: "weather",
        locationPrecision: "unknown",
        publishedAt: "2025-01-01T00:00:00.000Z",
        coordinates: [5, 2],
      }),
    ];

    for (const { assessment } of rankEventsByExposure(
      events,
      testRoute,
      referenceAt,
    )) {
      expect(assessment.score).toBeGreaterThanOrEqual(0);
      expect(assessment.score).toBeLessThanOrEqual(100);
    }
  });

  it("keeps reports older than 30 days in the guarded band", () => {
    const assessment = scoreEvent(
      eventFixture({ publishedAt: "2025-01-01T00:00:00.000Z" }),
      testRoute,
      referenceAt,
    );

    expect(assessment?.band).toBe("guarded");
  });

  it("ranks the replay reports differently for the Suez and Cape routes", () => {
    const suez = routes.find((route) => route.id === "suez");
    const cape = routes.find((route) => route.id === "cape");

    expect(suez).toBeDefined();
    expect(cape).toBeDefined();

    const suezRanking = rankEventsByExposure(
      replayEvents,
      suez!,
      REPLAY_SNAPSHOT_AT,
    );
    const capeRanking = rankEventsByExposure(
      replayEvents,
      cape!,
      REPLAY_SNAPSHOT_AT,
    );

    expect(suezRanking[0]?.event.id).toBe("rubymar-gulf-of-aden");
    expect(capeRanking[0]?.event.id).toBe("msc-antonia-container-loss");
    expect(suezRanking.map(({ event }) => event.id)).not.toEqual(
      capeRanking.map(({ event }) => event.id),
    );
  });
});
