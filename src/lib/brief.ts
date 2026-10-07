import { z } from "zod";

import type { Route } from "@/data/routes";
import type { RankedEvent } from "@/lib/exposure";

export const BRIEF_EVENT_LIMIT = 8;
export const FALLBACK_EVENT_LIMIT = 3;

export const briefEvidenceSchema = z
  .object({
    statement: z.string().trim().min(1).max(420),
    eventIds: z.array(z.string().min(1)).min(1).max(BRIEF_EVENT_LIMIT),
  })
  .strict();

export const generatedBriefSchema = z
  .object({
    summary: z.string().trim().min(1).max(900),
    evidence: z.array(briefEvidenceSchema).max(6),
    analystChecks: z.array(z.string().trim().min(1).max(280)).max(5),
    openUncertainties: z.array(z.string().trim().min(1).max(280)).max(5),
  })
  .strict();

export const briefResponseSchema = generatedBriefSchema
  .extend({
    mode: z.enum(["ai", "fallback"]),
    sourceMode: z.enum(["live", "replay"]),
    sourceUpdatedAt: z.iso.datetime(),
    generatedAt: z.iso.datetime(),
    fallbackReason: z.string().nullable(),
    sanitization: z.object({
      citationsRemoved: z.number().int().nonnegative(),
      evidenceRemoved: z.number().int().nonnegative(),
    }),
  })
  .strict();

export type GeneratedBrief = z.infer<typeof generatedBriefSchema>;
export type BriefResponse = z.infer<typeof briefResponseSchema>;

export function sanitizeBrief(
  brief: GeneratedBrief,
  allowedEventIds: Iterable<string>,
) {
  const allowed = new Set(allowedEventIds);
  let citationsRemoved = 0;
  let evidenceRemoved = 0;

  const evidence = brief.evidence.flatMap((item) => {
    const eventIds = [
      ...new Set(
        item.eventIds.filter((eventId) => {
          const accepted = allowed.has(eventId);
          if (!accepted) {
            citationsRemoved += 1;
          }
          return accepted;
        }),
      ),
    ];

    if (eventIds.length === 0) {
      evidenceRemoved += 1;
      return [];
    }

    return [{ ...item, eventIds }];
  });

  return {
    brief: { ...brief, evidence },
    sanitization: {
      citationsRemoved,
      evidenceRemoved,
    },
  };
}

export function containsRouteRecommendation(brief: GeneratedBrief) {
  const text = [
    brief.summary,
    ...brief.evidence.map(({ statement }) => statement),
    ...brief.analystChecks,
    ...brief.openUncertainties,
  ].join(" ");

  return /\b(?:should|must|recommend(?:s|ed|ing)?|advise(?:s|d|ing)?|consider|need(?:s)? to|ought to)\b[^.]{0,80}\b(?:re-?rout(?:e|ing)|divert(?:ing)?|avoid(?:ing)? (?:the |this )?route|switch(?:ing)? routes?)\b/i.test(
    text,
  );
}

export function buildRuleBasedBrief(
  route: Route,
  rankedEvents: RankedEvent[],
): GeneratedBrief {
  const topEvents = rankedEvents.slice(0, FALLBACK_EVENT_LIMIT);

  if (topEvents.length === 0) {
    return {
      summary: `No usable public reports were found within 500 km of ${route.name}. This does not establish that the route is free from disruption.`,
      evidence: [],
      analystChecks: [
        "Check current carrier, port and maritime authority notices before acting.",
      ],
      openUncertainties: [
        "No public-report evidence was available for this brief.",
        "No private carrier, port or vessel telemetry was evaluated.",
      ],
    };
  }

  const highest = topEvents[0];
  const impreciseLocations = topEvents.some(
    ({ event }) =>
      event.locationPrecision === "regional" ||
      event.locationPrecision === "unknown",
  );

  return {
    summary:
      `${route.name} has ${topEvents.length} leading public ` +
      `${topEvents.length === 1 ? "report" : "reports"} in this brief. ` +
      `The highest-ranked report is “${highest.event.title}” at ` +
      `${highest.assessment.score}/100, ` +
      `${highest.assessment.distanceKm.toFixed(1)} km from the route.`,
    evidence: topEvents.map(({ event, assessment }) => ({
      statement:
        `“${event.title}” was published by ${event.sourceName} on ` +
        `${event.publishedAt.slice(0, 10)} and scored ` +
        `${assessment.score}/100 at ` +
        `${assessment.distanceKm.toFixed(1)} km from the route.`,
      eventIds: [event.id],
    })),
    analystChecks: [
      "Open each cited source and confirm that the reported condition remains current.",
      "Confirm voyage timing against current carrier, port and maritime authority notices.",
      "Review approximate or regional report locations against a primary source where possible.",
    ],
    openUncertainties: [
      "Public reporting may lag operational conditions and does not establish vessel-level exposure.",
      ...(impreciseLocations
        ? ["One or more cited reports use a regional or unknown location."]
        : []),
      "No private carrier, port or vessel telemetry was evaluated.",
    ],
  };
}
