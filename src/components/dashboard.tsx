"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";

import {
  events as replayEvents,
  REPLAY_SNAPSHOT_AT,
} from "@/data/replay-events";
import { routes, type Route } from "@/data/routes";
import {
  briefResponseSchema,
  buildRuleBasedBrief,
  type BriefResponse,
} from "@/lib/brief";
import { eventFeedSchema, type EventFeed } from "@/lib/event-feed";
import type { Event } from "@/lib/events";
import {
  rankEventsByExposure,
  type ExposureAssessment,
  type RankedEvent,
} from "@/lib/exposure";
import { BriefPanel } from "@/components/brief-panel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

const RiskMap = dynamic(() => import("@/components/risk-map"), {
  ssr: false,
  loading: () => (
    <div className="flex size-full items-center justify-center bg-[#070809]">
      <div className="w-44 space-y-3">
        <Skeleton className="h-2 w-full" />
        <Skeleton className="mx-auto size-24 rounded-full" />
        <Skeleton className="h-2 w-3/4" />
      </div>
    </div>
  ),
});

function DataStatus({
  feed,
  loading,
}: {
  feed: EventFeed | null;
  loading: boolean;
}) {
  if (loading || !feed) {
    return (
      <div className="flex items-center gap-2 text-[10px] tracking-[0.14em] text-zinc-500 uppercase">
        <span className="size-1.5 rounded-full bg-zinc-700" />
        Checking data
      </div>
    );
  }

  if (feed.mode === "live") {
    const updatedAt = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(feed.updatedAt));

    return (
      <div className="flex items-center gap-2 text-[10px] tracking-[0.14em] text-zinc-300 uppercase">
        <span className="size-1.5 rounded-full bg-zinc-300" />
        Live · updated {updatedAt}
      </div>
    );
  }

  return (
    <div className="max-w-[15rem] text-right">
      <div className="text-[10px] tracking-[0.14em] text-zinc-300 uppercase">
        Replay
      </div>
      <div className="mt-0.5 text-[10px] leading-4 text-zinc-600">
        {feed.provider.reason}
      </div>
    </div>
  );
}

function formatPublishedAt(event: Event) {
  const formattedDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(event.timePrecision === "minute"
      ? {
          hour: "2-digit" as const,
          minute: "2-digit" as const,
          timeZone: "UTC",
          timeZoneName: "short" as const,
        }
      : {}),
  }).format(new Date(event.publishedAt));

  return event.timePrecision === "date"
    ? `${formattedDate} · time not published`
    : formattedDate;
}

function getSourceDomain(event: Event) {
  return new URL(event.sourceUrl).hostname.replace(/^www\./, "");
}

function RoutePicker({
  route,
  onRouteChange,
}: {
  route: Route;
  onRouteChange: (routeId: Route["id"]) => void;
}) {
  return (
    <Select value={route.id} onValueChange={onRouteChange}>
      <SelectTrigger aria-label="Select shipping route">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {routes.map((routeOption) => (
          <SelectItem key={routeOption.id} value={routeOption.id}>
            {routeOption.shortName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EventList({
  rankedEvents,
  selectedEventId,
  onSelect,
}: {
  rankedEvents: RankedEvent[];
  selectedEventId: string;
  onSelect: (eventId: string) => void;
}) {
  if (rankedEvents.length === 0) {
    return (
      <div className="border border-dashed border-white/10 p-6 text-sm text-zinc-500">
        No public reports are available for this route.
      </div>
    );
  }

  return (
    <ol className="divide-y divide-white/8">
      {rankedEvents.map(({ event, assessment }, index) => {
        const selected = event.id === selectedEventId;

        return (
          <li key={event.id}>
            <button
              type="button"
              onClick={() => onSelect(event.id)}
              aria-pressed={selected}
              className="group grid w-full grid-cols-[2rem_1fr_auto] gap-4 px-5 py-5 text-left transition-colors duration-150 hover:bg-white/[0.035] focus-visible:bg-white/[0.035] focus-visible:outline-none aria-pressed:bg-white/[0.055]"
            >
              <span className="pt-0.5 font-mono text-xs tabular-nums text-zinc-600">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span className="mb-2 block font-mono text-[10px] text-zinc-600">
                  {getSourceDomain(event)}
                </span>
                <span className="block text-[13px] leading-5 font-medium text-zinc-200 group-hover:text-white">
                  {event.title}
                </span>
                <span className="mt-2.5 block text-[11px] text-zinc-500">
                  {event.locationName}
                </span>
              </span>
              <span
                className={
                  assessment.band === "high"
                    ? "font-mono text-xl tabular-nums text-[#c56a6a]"
                    : "font-mono text-xl tabular-nums text-zinc-400"
                }
              >
                {assessment.score}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function EventListSkeleton() {
  return (
    <div className="space-y-px">
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className="grid grid-cols-[2rem_1fr_auto] gap-4 border-b border-white/8 px-5 py-5"
        >
          <Skeleton className="h-3 w-4" />
          <div className="space-y-2.5">
            <Skeleton className="h-2 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-6 w-7" />
        </div>
      ))}
    </div>
  );
}

function BriefSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3 border-b border-white/8 pb-5">
        <Skeleton className="h-2 w-44" />
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-3 w-36" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}

function EventDetail({
  event,
  assessment,
}: {
  event: Event;
  assessment: ExposureAssessment;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/8 pb-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <span className="text-[10px] tracking-[0.16em] text-zinc-500 uppercase">
            Calculated route exposure
          </span>
          <span className="border border-white/10 px-2 py-1 text-[10px] tracking-[0.14em] text-zinc-400 uppercase">
            {assessment.band}
          </span>
        </div>
        <div className="font-mono text-6xl leading-none tracking-[-0.06em] tabular-nums text-white">
          {assessment.score}
          <span className="ml-2 text-base tracking-normal text-zinc-600">
            /100
          </span>
        </div>
        <p className="mt-3 text-xs leading-5 text-zinc-500">
          Transparent exposure score from route distance, category, report age
          and stated location precision. It is not a prediction or rerouting
          recommendation.
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-white/8 pt-5 text-xs">
          <div>
            <dt className="text-zinc-600">Route distance</dt>
            <dd className="mt-1 font-mono tabular-nums text-zinc-300">
              {assessment.distanceKm.toFixed(1)} km
            </dd>
          </div>
          <div>
            <dt className="text-zinc-600">Distance points</dt>
            <dd className="mt-1 font-mono tabular-nums text-zinc-300">
              +{assessment.breakdown.distance}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-600">Category points</dt>
            <dd className="mt-1 font-mono tabular-nums text-zinc-300">
              +{assessment.breakdown.category}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-600">Recency points</dt>
            <dd className="mt-1 font-mono tabular-nums text-zinc-300">
              +{assessment.breakdown.recency}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-600">Location precision</dt>
            <dd className="mt-1 font-mono tabular-nums text-zinc-300">
              +{assessment.breakdown.locationPrecision}
            </dd>
          </div>
        </dl>
      </div>
      <div className="space-y-6 py-6">
        <div>
          <div className="mb-2 text-[10px] tracking-[0.16em] text-zinc-500 uppercase">
            Public report
          </div>
          <h2 className="text-lg leading-6 font-medium text-zinc-100">
            {event.title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">{event.summary}</p>
        </div>
        <dl className="grid grid-cols-[6rem_1fr] gap-x-4 gap-y-3 border-y border-white/8 py-5 text-xs">
          <dt className="text-zinc-600">Source</dt>
          <dd className="text-zinc-300">{event.sourceName}</dd>
          <dt className="text-zinc-600">Published</dt>
          <dd className="font-mono tabular-nums text-zinc-300">
            {formatPublishedAt(event)}
          </dd>
          <dt className="text-zinc-600">Location</dt>
          <dd className="text-zinc-300">{event.locationName}</dd>
          <dt className="text-zinc-600">Data mode</dt>
          <dd className="text-zinc-300">
            {event.mode === "live" ? "Live · GDELT Cloud" : "Curated replay"}
          </dd>
        </dl>
        <div>
          <div className="mb-2 text-[10px] tracking-[0.16em] text-zinc-500 uppercase">
            Map position
          </div>
          <p className="text-xs leading-5 text-zinc-500">
            {event.locationNote}
          </p>
        </div>
      </div>
      <div className="mt-auto pt-2">
        <Button asChild className="w-full">
          <a href={event.sourceUrl} target="_blank" rel="noreferrer">
            Read original report
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        </Button>
      </div>
    </div>
  );
}

export function Dashboard() {
  const [routeId, setRouteId] = useState<Route["id"]>("suez");
  const [feed, setFeed] = useState<EventFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"event" | "brief" | null>(
    null,
  );
  const [mapFocusRequest, setMapFocusRequest] = useState<{
    eventId: string;
    sequence: number;
  } | null>(null);
  const briefRequestRef = useRef<AbortController | null>(null);
  const mapFocusSequenceRef = useRef(0);

  const route = routes.find((candidate) => candidate.id === routeId) ?? routes[0];

  useEffect(() => {
    const controller = new AbortController();

    async function loadEvents() {
      try {
        const response = await fetch(`/api/events?routeId=${routeId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Events API returned HTTP ${response.status}`);
        }
        const nextFeed = eventFeedSchema.parse(await response.json());
        setFeed(nextFeed);
        setSelectedEventId(nextFeed.events[0]?.id ?? "");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        const fallbackFeed = eventFeedSchema.parse({
          mode: "replay",
          updatedAt: REPLAY_SNAPSHOT_AT,
          provider: {
            name: "GDELT Cloud",
            status: "fallback",
            reason:
              error instanceof Error
                ? `Events API unavailable: ${error.message}`
                : "Events API unavailable.",
          },
          events: replayEvents,
        });
        setFeed(fallbackFeed);
        setSelectedEventId(fallbackFeed.events[0]?.id ?? "");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadEvents();
    return () => controller.abort();
  }, [routeId]);

  useEffect(
    () => () => {
      briefRequestRef.current?.abort();
    },
    [],
  );

  const activeEvents = useMemo(() => feed?.events ?? [], [feed]);
  const rankedEvents = useMemo(
    () =>
      feed
        ? rankEventsByExposure(activeEvents, route, feed.updatedAt)
        : [],
    [activeEvents, feed, route],
  );
  const assessments = useMemo(
    () => rankedEvents.map(({ assessment }) => assessment),
    [rankedEvents],
  );
  const rankedMapEvents = useMemo(
    () => rankedEvents.map(({ event }) => event),
    [rankedEvents],
  );
  const selected =
    rankedEvents.find(({ event }) => event.id === selectedEventId) ??
    rankedEvents[0];

  const handleRouteChange = (nextRouteId: Route["id"]) => {
    briefRequestRef.current?.abort();
    setRouteId(nextRouteId);
    setLoading(true);
    setBrief(null);
    setBriefLoading(false);
    setBriefOpen(false);
    setMobilePanel(null);
    setMapFocusRequest(null);
  };

  const handleEventSelect = (eventId: string, focusMap = false) => {
    setSelectedEventId(eventId);
    setBriefOpen(false);
    if (focusMap) {
      mapFocusSequenceRef.current += 1;
      setMapFocusRequest({
        eventId,
        sequence: mapFocusSequenceRef.current,
      });
    }
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setMobilePanel("event");
    }
  };

  const handleListEventSelect = (eventId: string) => {
    handleEventSelect(eventId, true);
  };

  const handleGenerateBrief = async () => {
    if (!feed || rankedEvents.length === 0) {
      return;
    }

    briefRequestRef.current?.abort();
    const controller = new AbortController();
    briefRequestRef.current = controller;
    setBrief(null);
    setBriefLoading(true);
    setBriefOpen(true);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setMobilePanel("brief");
    }

    try {
      const response = await fetch("/api/brief", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ routeId }),
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Brief API returned HTTP ${response.status}`);
      }

      const nextBrief = briefResponseSchema.parse(await response.json());
      if (!controller.signal.aborted) {
        setBrief(nextBrief);
      }
    } catch {
      if (controller.signal.aborted) {
        return;
      }

      setBrief(
        briefResponseSchema.parse({
          ...buildRuleBasedBrief(route, rankedEvents),
          mode: "fallback",
          sourceMode: feed.mode,
          sourceUpdatedAt: feed.updatedAt,
          generatedAt: new Date().toISOString(),
          fallbackReason:
            "Brief API was unavailable; this summary was generated locally from the displayed reports.",
          sanitization: {
            citationsRemoved: 0,
            evidenceRemoved: 0,
          },
        }),
      );
    } finally {
      if (briefRequestRef.current === controller) {
        briefRequestRef.current = null;
        setBriefLoading(false);
      }
    }
  };

  const handleBriefClose = () => {
    setBriefOpen(false);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setMobilePanel("event");
    }
  };

  return (
    <main className="flex min-h-dvh flex-col bg-[#090a0b] text-zinc-100 lg:relative lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      <header className="flex min-h-16 shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-6 lg:absolute lg:top-4 lg:right-4 lg:left-4 lg:z-30 lg:min-h-12 lg:border lg:bg-[#0d0e10] lg:px-5 lg:py-0">
        <div className="flex items-baseline gap-3">
          <h1 className="text-sm font-semibold tracking-[0.15em] uppercase">
            Avertly
          </h1>
          <span className="hidden text-xs text-zinc-600 sm:inline">
            Route exposure workspace
          </span>
        </div>
        <DataStatus feed={feed} loading={loading} />
      </header>
      <section className="grid flex-1 lg:absolute lg:inset-0 lg:block lg:min-h-0">
        <aside className="order-2 border-white/10 bg-[#0d0e10] lg:absolute lg:top-20 lg:bottom-4 lg:left-4 lg:z-20 lg:w-[300px] lg:overflow-y-auto lg:border xl:w-[340px]">
          <div className="border-b border-white/8 p-5 sm:p-6">
            <label className="mb-2 block text-[10px] tracking-[0.16em] text-zinc-500 uppercase">
              Active route
            </label>
            <RoutePicker
              route={route}
              onRouteChange={handleRouteChange}
            />
            <p className="mt-3 text-xs text-zinc-600">{route.description}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 w-full"
              disabled={
                loading ||
                !feed ||
                rankedEvents.length === 0 ||
                briefLoading
              }
              onClick={() => void handleGenerateBrief()}
            >
              {briefLoading ? "Generating brief…" : "Generate brief"}
            </Button>
          </div>
          <div className="flex items-center justify-between px-5 pt-6 pb-3">
            <span className="text-[10px] tracking-[0.16em] text-zinc-500 uppercase">
              Public reports
            </span>
            <span className="font-mono text-xs tabular-nums text-zinc-600">
              {loading ? "—" : rankedEvents.length}
            </span>
          </div>
          {loading || !selected ? (
            <EventListSkeleton />
          ) : (
            <EventList
              rankedEvents={rankedEvents}
              selectedEventId={selected.event.id}
              onSelect={handleListEventSelect}
            />
          )}
        </aside>
        <section className="order-1 h-[45dvh] min-h-[330px] border-b border-white/10 lg:absolute lg:inset-0 lg:z-0 lg:h-full lg:min-h-0 lg:overflow-hidden lg:border-b-0 lg:[clip-path:inset(4rem_0_0_0)]">
          {!feed || !selected ? (
            <div className="flex size-full items-center justify-center bg-[#070809]">
              <div className="w-44 space-y-3">
                <Skeleton className="h-2 w-full" />
                <Skeleton className="mx-auto size-24 rounded-full" />
                <Skeleton className="h-2 w-3/4" />
              </div>
            </div>
          ) : (
            <RiskMap
              route={route}
              events={rankedMapEvents}
              assessments={assessments}
              selectedEventId={selected.event.id}
              focusRequest={mapFocusRequest}
              onSelectEvent={handleEventSelect}
            />
          )}
        </section>
        <aside className="order-3 hidden min-h-0 border-white/10 bg-[#0d0e10] p-7 lg:absolute lg:top-20 lg:right-4 lg:bottom-4 lg:z-20 lg:block lg:w-[320px] lg:overflow-y-auto lg:border xl:w-[360px]">
          {briefOpen && briefLoading ? (
            <BriefSkeleton />
          ) : briefOpen && brief ? (
            <BriefPanel
              brief={brief}
              events={rankedMapEvents}
              onSelectCitation={handleListEventSelect}
              onClose={handleBriefClose}
            />
          ) : !loading && selected ? (
            <EventDetail
              event={selected.event}
              assessment={selected.assessment}
            />
          ) : (
            <div className="space-y-5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-16 w-24" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}
        </aside>
      </section>
      {selected && (
        <div>
          <Sheet
            open={mobilePanel !== null}
            onOpenChange={(open) => {
              if (!open) {
                setMobilePanel(null);
              }
            }}
          >
            <SheetContent>
              <SheetTitle className="sr-only">
                {mobilePanel === "brief"
                  ? "Route brief"
                  : selected.event.title}
              </SheetTitle>
              <SheetDescription className="sr-only">
                {mobilePanel === "brief"
                  ? "Generated route brief with cited public reports."
                  : "Public report details and exposure status."}
              </SheetDescription>
              {mobilePanel === "brief" ? (
                briefLoading ? (
                  <BriefSkeleton />
                ) : brief ? (
                  <BriefPanel
                    brief={brief}
                    events={rankedMapEvents}
                    onSelectCitation={handleListEventSelect}
                    onClose={handleBriefClose}
                  />
                ) : null
              ) : (
                <EventDetail
                  event={selected.event}
                  assessment={selected.assessment}
                />
              )}
            </SheetContent>
          </Sheet>
        </div>
      )}
    </main>
  );
}
