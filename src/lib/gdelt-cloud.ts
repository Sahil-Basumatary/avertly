import "server-only";

import { cacheLife } from "next/cache";
import { z } from "zod";

import { routes, type Route } from "@/data/routes";
import {
  eventSchema,
  type Event,
  type EventSource,
  type EventSourceSnapshot,
} from "@/lib/events";

const gdeltEndpoint = "https://gdeltcloud.com/api/v2/events";
const directCategories = [
  "Battles",
  "Explosions/Remote violence",
  "Violence against civilians",
].join(",");
const operationalCategories = [
  "Protests",
  "Strategic developments",
  "POLITICAL",
  "INFRASTRUCTURE",
  "DEMOGRAPHIC",
].join(",");
const shippingSearch =
  "maritime security shipping port strike blockade vessel canal strait";

const gdeltEnvelopeSchema = z.object({
  success: z.literal(true),
  data: z.array(z.unknown()),
});

const gdeltEventSchema = z.object({
  id: z.string().min(1),
  title: z.string().nullable(),
  summary: z.string().nullable(),
  event_date: z.string(),
  category: z.string().nullable(),
  subcategory: z.string().nullable(),
  subcategory_label: z.string().nullable().optional(),
  geo: z.object({
    country: z.string().nullable(),
    admin1: z.string().nullable(),
    location: z.string().nullable(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    geo_precision_label: z.string().nullable().optional(),
  }),
  top_articles: z.array(
    z.object({
      url: z.string(),
      title: z.string().nullable(),
      domain: z.string().nullable(),
      rank: z.number(),
    }),
  ),
});

type GdeltEvent = z.infer<typeof gdeltEventSchema>;

export type GdeltFailureCode =
  | "missing_key"
  | "unauthorized"
  | "rate_limited"
  | "timeout"
  | "provider_error"
  | "bad_payload"
  | "no_usable_events";

export class GdeltSourceError extends Error {
  constructor(
    readonly code: GdeltFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "GdeltSourceError";
  }
}

function buildUrl(
  route: Route,
  categories: string,
  search?: string,
) {
  const url = new URL(gdeltEndpoint);
  url.searchParams.set("country", route.countryCodes.join(","));
  url.searchParams.set("country_match", "location");
  url.searchParams.set("category", categories);
  url.searchParams.set("days", "7");
  url.searchParams.set("limit", "25");
  if (search) {
    url.searchParams.set("search", search);
  } else {
    url.searchParams.set("sort", "recent");
  }
  return url;
}

function getHttpArticle(event: GdeltEvent) {
  return event.top_articles.find((article) => {
    try {
      const protocol = new URL(article.url).protocol;
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  });
}

const shippingTerms =
  /\b(port|harbou?r|dock|shipping|maritime|vessel|ship|seafarer|canal|strait|blockade|cargo|terminal|freight|naval|piracy|pirate|tanker|container|strike)\b/i;

function isShippingRelevant(event: GdeltEvent) {
  if (
    event.category === "Battles" ||
    event.category === "Explosions/Remote violence"
  ) {
    return true;
  }

  if (event.category === "Violence against civilians") {
    return event.subcategory === "Attack";
  }

  if (
    event.category === "INFRASTRUCTURE" &&
    ["IN02", "IN03", "IN05"].includes(event.subcategory ?? "")
  ) {
    return true;
  }

  if (
    event.category === "POLITICAL" &&
    ["133", "138", "1381", "1384", "0872"].includes(
      event.subcategory ?? "",
    )
  ) {
    return true;
  }

  const searchableText = [
    event.title,
    event.summary,
    event.subcategory_label,
    event.geo.location,
  ]
    .filter(Boolean)
    .join(" ");

  return shippingTerms.test(searchableText);
}

function normaliseLocationPrecision(
  value: string | null | undefined,
): Event["locationPrecision"] {
  switch (value?.toLowerCase()) {
    case "exact_place":
    case "exact":
      return "exact";
    case "nearby_area":
    case "nearby":
      return "nearby";
    case "country_or_region":
    case "regional":
      return "regional";
    default:
      return "unknown";
  }
}

function normaliseEvent(input: unknown): Event | null {
  const parsed = gdeltEventSchema.safeParse(input);
  if (!parsed.success || !isShippingRelevant(parsed.data)) {
    return null;
  }

  const event = parsed.data;
  const article = getHttpArticle(event);
  const validDate = z.iso.date().safeParse(event.event_date);
  if (
    !article ||
    !validDate.success ||
    event.geo.latitude === null ||
    event.geo.longitude === null
  ) {
    return null;
  }

  const locationName =
    event.geo.location ??
    event.geo.admin1 ??
    event.geo.country ??
    "Reported location";
  const label =
    event.subcategory_label ?? event.subcategory ?? event.category ?? "event";
  const title =
    event.title?.trim() ||
    article.title?.trim() ||
    `${label} near ${locationName}`;
  const summary =
    event.summary?.trim() ||
    `GDELT Cloud coded this public report as ${label}.`;
  const sourceName =
    article.domain?.trim() || new URL(article.url).hostname.replace(/^www\./, "");
  const category =
    event.category === "INFRASTRUCTURE" ||
    event.category === "DEMOGRAPHIC" ||
    event.category === "Protests" ||
    event.category === "Strategic developments"
      ? "operations"
      : "security";

  const normalised = eventSchema.safeParse({
    id: `gdelt:${event.id}`,
    title,
    summary,
    sourceName,
    sourceUrl: article.url,
    publishedAt: `${event.event_date}T00:00:00.000Z`,
    timePrecision: "date",
    coordinates: [event.geo.longitude, event.geo.latitude],
    locationName,
    locationNote: event.geo.geo_precision_label
      ? `GDELT Cloud primary event location · ${event.geo.geo_precision_label}.`
      : "GDELT Cloud primary event location; precision was not provided.",
    locationPrecision: normaliseLocationPrecision(
      event.geo.geo_precision_label,
    ),
    category,
    mode: "live",
  });

  return normalised.success ? normalised.data : null;
}

async function fetchPayload(url: URL, apiKey: string, signal: AbortSignal) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
    signal,
  });

  if (response.status === 401 || response.status === 403) {
    throw new GdeltSourceError(
      "unauthorized",
      "GDELT Cloud rejected the configured API key.",
    );
  }
  if (response.status === 429) {
    throw new GdeltSourceError(
      "rate_limited",
      "GDELT Cloud rate or usage limit was reached.",
    );
  }
  if (!response.ok) {
    throw new GdeltSourceError(
      "provider_error",
      `GDELT Cloud returned HTTP ${response.status}.`,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw error;
    }
    throw new GdeltSourceError(
      "bad_payload",
      "GDELT Cloud returned invalid JSON.",
    );
  }

  const parsed = gdeltEnvelopeSchema.safeParse(body);
  if (!parsed.success) {
    throw new GdeltSourceError(
      "bad_payload",
      "GDELT Cloud returned an unexpected payload.",
    );
  }
  return parsed.data.data;
}

async function getCachedEvents(
  routeId: Route["id"],
): Promise<EventSourceSnapshot> {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 3600, expire: 7200 });

  const apiKey = process.env.GDELT_API_KEY?.trim();
  if (!apiKey) {
    throw new GdeltSourceError(
      "missing_key",
      "GDELT_API_KEY is not configured.",
    );
  }

  const route = routes.find((candidate) => candidate.id === routeId);
  if (!route) {
    throw new GdeltSourceError(
      "provider_error",
      "The route is not configured for GDELT Cloud.",
    );
  }

  const signal = AbortSignal.timeout(8000);

  try {
    const payloads = await Promise.all([
      fetchPayload(buildUrl(route, directCategories), apiKey, signal),
      fetchPayload(
        buildUrl(route, operationalCategories, shippingSearch),
        apiKey,
        signal,
      ),
    ]);
    const uniqueEvents = new Map<string, Event>();
    for (const item of payloads.flat()) {
      const event = normaliseEvent(item);
      if (event) {
        uniqueEvents.set(event.id, event);
      }
    }
    const events = [...uniqueEvents.values()]
      .sort((first, second) =>
        second.publishedAt.localeCompare(first.publishedAt),
      )
      .slice(0, 60);

    if (events.length === 0) {
      throw new GdeltSourceError(
        "no_usable_events",
        "GDELT Cloud returned no usable shipping reports for this route.",
      );
    }

    return {
      events,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof GdeltSourceError) {
      throw error;
    }
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw new GdeltSourceError(
        "timeout",
        "GDELT Cloud did not respond within 8 seconds.",
      );
    }
    throw new GdeltSourceError(
      "provider_error",
      "GDELT Cloud could not be reached.",
    );
  }
}

export class GdeltCloudEventSource implements EventSource {
  readonly mode = "live" as const;

  getEvents(routeId: Route["id"]) {
    if (!process.env.GDELT_API_KEY?.trim()) {
      return Promise.reject(
        new GdeltSourceError(
          "missing_key",
          "GDELT_API_KEY is not configured.",
        ),
      );
    }
    return getCachedEvents(routeId);
  }
}

export const gdeltCloudEventSource = new GdeltCloudEventSource();
