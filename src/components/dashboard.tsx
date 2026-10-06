"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";

import {
  events,
  replayAssessments,
  type RouteAssessment,
} from "@/data/replay-events";
import { routes, type Route } from "@/data/routes";
import type { Event } from "@/lib/events";
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
  rankedEvents: Array<{ event: Event; assessment: RouteAssessment }>;
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
              className="group grid w-full grid-cols-[2rem_1fr_auto] gap-3 px-4 py-4 text-left transition-colors duration-150 hover:bg-white/[0.035] focus-visible:bg-white/[0.035] focus-visible:outline-none aria-pressed:bg-white/[0.055]"
            >
              <span className="pt-0.5 font-mono text-xs tabular-nums text-zinc-600">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span className="mb-1.5 block text-[10px] tracking-[0.14em] text-zinc-500 uppercase">
                  Public report · {event.sourceName}
                </span>
                <span className="block text-sm leading-5 font-medium text-zinc-200 group-hover:text-white">
                  {event.title}
                </span>
                <span className="mt-2 block text-xs text-zinc-500">
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

function EventDetail({
  event,
  assessment,
}: {
  event: Event;
  assessment: RouteAssessment;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/8 pb-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <span className="text-[10px] tracking-[0.16em] text-zinc-500 uppercase">
            Curated replay exposure
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
          Fixture value for this replay. It is not a prediction or a rerouting
          recommendation. Formula-based scoring is the next milestone.
        </p>
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
          <dd className="text-zinc-300">Curated replay</dd>
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
  const [selectedEventId, setSelectedEventId] = useState(
    replayAssessments.suez[0].eventId,
  );
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const route = routes.find((candidate) => candidate.id === routeId) ?? routes[0];
  const assessments = replayAssessments[route.id];
  const rankedEvents = useMemo(
    () =>
      assessments.flatMap((assessment) => {
        const event = events.find(
          (candidate) => candidate.id === assessment.eventId,
        );
        return event ? [{ event, assessment }] : [];
      }),
    [assessments],
  );
  const selected =
    rankedEvents.find(({ event }) => event.id === selectedEventId) ??
    rankedEvents[0];

  const handleRouteChange = (nextRouteId: Route["id"]) => {
    setRouteId(nextRouteId);
    setSelectedEventId(replayAssessments[nextRouteId][0].eventId);
    setMobileDetailOpen(false);
  };

  const handleEventSelect = (eventId: string) => {
    setSelectedEventId(eventId);
    setMobileDetailOpen(true);
  };

  return (
    <main className="flex min-h-dvh flex-col bg-[#090a0b] text-zinc-100">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4 sm:px-6">
        <div className="flex items-baseline gap-3">
          <h1 className="text-sm font-semibold tracking-[0.15em] uppercase">
            Avertly
          </h1>
          <span className="hidden text-xs text-zinc-600 sm:inline">
            Route exposure workspace
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] tracking-[0.14em] text-zinc-400 uppercase">
          <span className="size-1.5 rounded-full bg-zinc-500" />
          Replay data
        </div>
      </header>
      <section className="grid flex-1 lg:min-h-0 lg:grid-cols-[340px_minmax(0,1fr)_360px]">
        <aside className="order-2 border-white/10 bg-[#0d0e10] lg:order-1 lg:min-h-0 lg:border-r">
          <div className="border-b border-white/8 p-4 sm:p-5">
            <label className="mb-2 block text-[10px] tracking-[0.16em] text-zinc-500 uppercase">
              Active route
            </label>
            <RoutePicker
              route={route}
              onRouteChange={handleRouteChange}
            />
            <p className="mt-3 text-xs text-zinc-600">{route.description}</p>
          </div>
          <div className="flex items-center justify-between px-4 pt-5 pb-2">
            <span className="text-[10px] tracking-[0.16em] text-zinc-500 uppercase">
              Ranked public reports
            </span>
            <span className="font-mono text-xs tabular-nums text-zinc-600">
              {rankedEvents.length}
            </span>
          </div>
          <EventList
            rankedEvents={rankedEvents}
            selectedEventId={selected.event.id}
            onSelect={handleEventSelect}
          />
        </aside>
        <section className="order-1 h-[45dvh] min-h-[330px] border-b border-white/10 lg:order-2 lg:h-auto lg:min-h-0 lg:border-b-0">
          <RiskMap
            route={route}
            events={events}
            assessments={assessments}
            selectedEventId={selected.event.id}
            onSelectEvent={handleEventSelect}
          />
        </section>
        <aside className="order-3 hidden min-h-0 border-l border-white/10 bg-[#0d0e10] p-6 lg:block">
          <EventDetail
            event={selected.event}
            assessment={selected.assessment}
          />
        </aside>
      </section>
      <div className="lg:hidden">
        <Sheet open={mobileDetailOpen} onOpenChange={setMobileDetailOpen}>
          <SheetContent>
            <SheetTitle className="sr-only">{selected.event.title}</SheetTitle>
            <SheetDescription className="sr-only">
              Public report details and replay exposure.
            </SheetDescription>
            <EventDetail
              event={selected.event}
              assessment={selected.assessment}
            />
          </SheetContent>
        </Sheet>
      </div>
    </main>
  );
}
