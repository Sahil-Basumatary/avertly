import { z } from "zod";

export const eventSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  sourceName: z.string(),
  sourceUrl: z.url(),
  publishedAt: z.iso.datetime(),
  timePrecision: z.enum(["minute", "date"]),
  coordinates: z.tuple([
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
  ]),
  locationName: z.string(),
  locationNote: z.string(),
  category: z.enum(["security", "weather", "operations"]),
  mode: z.literal("replay"),
});

export type Event = z.infer<typeof eventSchema>;

export interface EventSource {
  readonly mode: Event["mode"];
  getEvents(): Promise<Event[]>;
}
