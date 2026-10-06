import { z } from "zod";

import { eventSchema } from "@/lib/events";

export const eventFeedSchema = z.object({
  mode: z.enum(["live", "replay"]),
  updatedAt: z.iso.datetime(),
  provider: z.object({
    name: z.literal("GDELT Cloud"),
    status: z.enum(["ok", "fallback"]),
    reason: z.string().nullable(),
  }),
  events: eventSchema.array(),
});

export type EventFeed = z.infer<typeof eventFeedSchema>;
