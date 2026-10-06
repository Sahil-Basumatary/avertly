import { eventSchema, type Event, type EventSource } from "@/lib/events";

const replayEvents = [
  {
    id: "rubymar-gulf-of-aden",
    title: "Cargo vessel Rubymar badly damaged after attack",
    summary:
      "The crew abandoned the vessel after an attack in the Gulf of Aden. The report said the ship was taking on water and at risk of sinking.",
    sourceName: "Reuters",
    sourceUrl:
      "https://www.reuters.com/world/yemens-houthis-say-ship-attacked-gulf-aden-may-sink-2024-02-19/",
    publishedAt: "2024-02-19T19:29:00Z",
    timePrecision: "minute",
    coordinates: [45.2, 12.3],
    locationName: "Gulf of Aden",
    locationNote:
      "Regional marker only. The public report identifies the Gulf of Aden but does not publish exact coordinates.",
    category: "security",
    mode: "replay",
  },
  {
    id: "cape-weather-shipping-stop",
    title: "Severe weather stops container traffic around the Cape",
    summary:
      "High winds and seas closed terminals and left vessels windbound while diverted container traffic faced a reported standstill.",
    sourceName: "The Maritime Executive",
    sourceUrl:
      "https://maritime-executive.com/article/cargo-ship-grounds-boxships-stopped-due-to-south-africa-s-bad-weather",
    publishedAt: "2024-07-10T00:00:00Z",
    timePrecision: "date",
    coordinates: [18.44, -33.91],
    locationName: "Cape Town",
    locationNote:
      "Named-place marker at Cape Town. The report covers disruption across several South African ports.",
    category: "weather",
    mode: "replay",
  },
  {
    id: "msc-antonia-container-loss",
    title: "MSC Antonia loses containers in Eastern Cape weather",
    summary:
      "The vessel reportedly lost about 46 containers and sustained damage in winter weather before diverting for assessment.",
    sourceName: "The Maritime Executive",
    sourceUrl:
      "https://maritime-executive.com/article/msc-boxship-becomes-third-in-2024-to-lose-boxes-overboard-off-south-africa",
    publishedAt: "2024-09-03T00:00:00Z",
    timePrecision: "date",
    coordinates: [29.75, -31.29],
    locationName: "29 nm north-east of Port St Johns",
    locationNote:
      "Approximate marker derived from the distance and direction stated in the public report.",
    category: "weather",
    mode: "replay",
  },
  {
    id: "rotterdam-it-disruption",
    title: "IT disruption affects a Rotterdam container terminal",
    summary:
      "The port said crucial maritime processes continued, while some port companies adjusted operations because of the software disruption.",
    sourceName: "Port of Rotterdam Authority",
    sourceUrl:
      "https://www.portofrotterdam.com/en/news-and-press-releases/it-disruption-crucial-processes-port-rotterdam-continue-uninterrupted",
    publishedAt: "2024-07-19T00:00:00Z",
    timePrecision: "date",
    coordinates: [4.14, 51.95],
    locationName: "Port of Rotterdam",
    locationNote:
      "Named-place marker. The port notice does not identify the affected terminal.",
    category: "operations",
    mode: "replay",
  },
] satisfies unknown[];

class ReplayEventSource implements EventSource {
  readonly mode = "replay" as const;

  async getEvents(): Promise<Event[]> {
    return eventSchema.array().parse(replayEvents);
  }
}

export const replayEventSource = new ReplayEventSource();
export const events = eventSchema.array().parse(replayEvents);

export type RouteAssessment = {
  eventId: Event["id"];
  score: number;
  band: "guarded" | "elevated" | "high";
};

export const replayAssessments: Record<"suez" | "cape", RouteAssessment[]> = {
  suez: [
    { eventId: "rubymar-gulf-of-aden", score: 84, band: "high" },
    { eventId: "rotterdam-it-disruption", score: 61, band: "elevated" },
    { eventId: "cape-weather-shipping-stop", score: 43, band: "guarded" },
    { eventId: "msc-antonia-container-loss", score: 36, band: "guarded" },
  ],
  cape: [
    { eventId: "cape-weather-shipping-stop", score: 86, band: "high" },
    { eventId: "msc-antonia-container-loss", score: 74, band: "elevated" },
    { eventId: "rotterdam-it-disruption", score: 61, band: "elevated" },
    { eventId: "rubymar-gulf-of-aden", score: 27, band: "guarded" },
  ],
};
