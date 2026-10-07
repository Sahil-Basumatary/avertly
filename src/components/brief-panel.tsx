"use client";

import type { BriefResponse } from "@/lib/brief";
import type { Event } from "@/lib/events";
import { Button } from "@/components/ui/button";

type BriefPanelProps = {
  brief: BriefResponse;
  events: Event[];
  onSelectCitation: (eventId: string) => void;
  onClose: () => void;
};

function formatSourceDate(value: string, mode: BriefResponse["sourceMode"]) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(mode === "live"
      ? {
          hour: "2-digit" as const,
          minute: "2-digit" as const,
          timeZone: "UTC",
          timeZoneName: "short" as const,
        }
      : {}),
  }).format(new Date(value));
}

export function BriefPanel({
  brief,
  events,
  onSelectCitation,
  onClose,
}: BriefPanelProps) {
  const eventById = new Map(events.map((event) => [event.id, event]));

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/8 pb-5">
        <div className="text-[10px] tracking-[0.16em] text-zinc-400 uppercase">
          {brief.mode === "ai"
            ? "AI draft · verify before acting"
            : "AI unavailable · rule-based summary"}
        </div>
        <h2 className="mt-3 text-xl font-medium text-white">Route brief</h2>
        <p className="mt-2 text-[11px] leading-4 text-zinc-600">
          {brief.sourceMode === "live"
            ? "Live reports · updated "
            : "Replay snapshot · "}
          {formatSourceDate(brief.sourceUpdatedAt, brief.sourceMode)}
        </p>
        <p className="mt-3 text-[11px] leading-4 text-zinc-500">
          Citation check · {brief.sanitization.citationsRemoved} unsupported{" "}
          {brief.sanitization.citationsRemoved === 1
            ? "citation"
            : "citations"}{" "}
          removed · {brief.sanitization.evidenceRemoved} unsupported evidence{" "}
          {brief.sanitization.evidenceRemoved === 1 ? "item" : "items"} removed
        </p>
        {brief.fallbackReason && (
          <p className="mt-2 text-[11px] leading-4 text-zinc-600">
            {brief.fallbackReason}
          </p>
        )}
      </div>
      <div className="space-y-6 py-6">
        <section>
          <h3 className="mb-2 text-[10px] tracking-[0.16em] text-zinc-500 uppercase">
            Summary
          </h3>
          <p className="text-sm leading-6 text-zinc-300">{brief.summary}</p>
        </section>
        <section>
          <h3 className="mb-3 text-[10px] tracking-[0.16em] text-zinc-500 uppercase">
            Evidence
          </h3>
          {brief.evidence.length === 0 ? (
            <p className="text-xs leading-5 text-zinc-600">
              No supported evidence was available.
            </p>
          ) : (
            <ol className="space-y-4">
              {brief.evidence.map((item, index) => (
                <li
                  key={`${item.statement}-${index}`}
                  className="border-l border-white/10 pl-3"
                >
                  <p className="text-xs leading-5 text-zinc-400">
                    {item.statement}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.eventIds.map((eventId) => {
                      const event = eventById.get(eventId);
                      if (!event) {
                        return null;
                      }
                      const reportNumber =
                        events.findIndex(({ id }) => id === eventId) + 1;

                      return (
                        <button
                          key={eventId}
                          type="button"
                          onClick={() => onSelectCitation(eventId)}
                          className="border border-white/12 px-2 py-1 text-[10px] text-zinc-400 transition-colors duration-150 hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                          aria-label={`Select cited report: ${event.title}`}
                        >
                          [{String(reportNumber).padStart(2, "0")}]{" "}
                          {event.sourceName}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section>
          <h3 className="mb-3 text-[10px] tracking-[0.16em] text-zinc-500 uppercase">
            Checks for the analyst
          </h3>
          <ul className="space-y-2">
            {brief.analystChecks.map((check, index) => (
              <li
                key={`${check}-${index}`}
                className="grid grid-cols-[1rem_1fr] text-xs leading-5 text-zinc-400"
              >
                <span className="font-mono text-zinc-700">—</span>
                {check}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="mb-3 text-[10px] tracking-[0.16em] text-zinc-500 uppercase">
            Open uncertainties
          </h3>
          <ul className="space-y-2">
            {brief.openUncertainties.map((uncertainty, index) => (
              <li
                key={`${uncertainty}-${index}`}
                className="grid grid-cols-[1rem_1fr] text-xs leading-5 text-zinc-500"
              >
                <span className="font-mono text-zinc-700">—</span>
                {uncertainty}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="mt-auto border-t border-white/8 pt-5">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onClose}
        >
          Back to selected report
        </Button>
      </div>
    </div>
  );
}
