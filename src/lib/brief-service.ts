import "server-only";

import { routes, type Route } from "@/data/routes";
import {
  BRIEF_EVENT_LIMIT,
  briefResponseSchema,
  buildRuleBasedBrief,
  containsRouteRecommendation,
  sanitizeBrief,
  type BriefResponse,
} from "@/lib/brief";
import { getEventFeed } from "@/lib/event-service";
import { rankEventsByExposure } from "@/lib/exposure";
import {
  generateGeminiBrief,
  GeminiBriefError,
} from "@/lib/gemini-brief";

function getRoute(routeId: Route["id"]) {
  return routes.find((route) => route.id === routeId) ?? routes[0];
}

function getFallbackReason(error: unknown) {
  if (error instanceof GeminiBriefError) {
    return error.message;
  }
  return "AI generation was unavailable or failed validation.";
}

export async function createBrief(
  routeId: Route["id"],
): Promise<BriefResponse> {
  const route = getRoute(routeId);
  const feed = await getEventFeed(routeId);
  const rankedEvents = rankEventsByExposure(
    feed.events,
    route,
    feed.updatedAt,
  ).slice(0, BRIEF_EVENT_LIMIT);
  let sanitization = {
    citationsRemoved: 0,
    evidenceRemoved: 0,
  };

  try {
    if (rankedEvents.length === 0) {
      throw new GeminiBriefError(
        "bad_response",
        "No scored events were available.",
      );
    }

    const generated = await generateGeminiBrief(
      route,
      rankedEvents,
      feed.mode,
      feed.updatedAt,
    );
    if (containsRouteRecommendation(generated)) {
      throw new GeminiBriefError(
        "bad_response",
        "Gemini returned a route recommendation.",
      );
    }

    const sanitized = sanitizeBrief(
      generated,
      rankedEvents.map(({ event }) => event.id),
    );
    sanitization = sanitized.sanitization;
    if (sanitized.brief.evidence.length === 0) {
      throw new GeminiBriefError(
        "bad_response",
        "Gemini returned no supported evidence.",
      );
    }

    return briefResponseSchema.parse({
      ...sanitized.brief,
      mode: "ai",
      sourceMode: feed.mode,
      sourceUpdatedAt: feed.updatedAt,
      generatedAt: new Date().toISOString(),
      fallbackReason: null,
      sanitization,
    });
  } catch (error) {
    return briefResponseSchema.parse({
      ...buildRuleBasedBrief(route, rankedEvents),
      mode: "fallback",
      sourceMode: feed.mode,
      sourceUpdatedAt: feed.updatedAt,
      generatedAt: new Date().toISOString(),
      fallbackReason: getFallbackReason(error),
      sanitization,
    });
  }
}
