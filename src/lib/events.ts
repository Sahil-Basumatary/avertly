import { z } from "zod";

export const eventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  sourceName: z.string().min(1),
  sourceUrl: z.url(),
  publishedAt: z.iso.datetime(),
  timePrecision: z.enum(["minute", "date"]),
  coordinates: z.tuple([
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
  ]),
  locationName: z.string(),
  locationNote: z.string(),
  locationPrecision: z.enum(["exact", "nearby", "regional", "unknown"]),
  category: z.enum(["security", "weather", "operations"]),
  mode: z.enum(["live", "replay"]),
});

export type Event = z.infer<typeof eventSchema>;

export type EventSourceSnapshot = {
  events: Event[];
  updatedAt: string;
};

export interface EventSource {
  readonly mode: Event["mode"];
  getEvents(routeId: "suez" | "cape"): Promise<EventSourceSnapshot>;
}
