import "server-only";

import { replayEventSource } from "@/data/replay-events";
import type { Route } from "@/data/routes";
import { eventFeedSchema, type EventFeed } from "@/lib/event-feed";
import {
  gdeltCloudEventSource,
  GdeltSourceError,
} from "@/lib/gdelt-cloud";

function getFallbackReason(error: unknown) {
  if (error instanceof GdeltSourceError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "GDELT Cloud is temporarily unavailable.";
}

export async function getEventFeed(
  routeId: Route["id"],
): Promise<EventFeed> {
  try {
    const snapshot = await gdeltCloudEventSource.getEvents(routeId);
    return eventFeedSchema.parse({
      mode: "live",
      updatedAt: snapshot.updatedAt,
      provider: {
        name: "GDELT Cloud",
        status: "ok",
        reason: null,
      },
      events: snapshot.events,
    });
  } catch (error) {
    const snapshot = await replayEventSource.getEvents(routeId);
    return eventFeedSchema.parse({
      mode: "replay",
      updatedAt: snapshot.updatedAt,
      provider: {
        name: "GDELT Cloud",
        status: "fallback",
        reason: getFallbackReason(error),
      },
      events: snapshot.events,
    });
  }
}
