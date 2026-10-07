import { describe, expect, it } from "vitest";

import {
  containsRouteRecommendation,
  sanitizeBrief,
  type GeneratedBrief,
} from "@/lib/brief";

describe("brief citation sanitization", () => {
  it("drops invented citations and evidence left without a valid citation", () => {
    const generated: GeneratedBrief = {
      summary: "Two evidence statements were generated.",
      evidence: [
        {
          statement: "This statement has one supported citation.",
          eventIds: ["event-1", "invented-event"],
        },
        {
          statement: "This statement has no supported citation.",
          eventIds: ["another-invented-event"],
        },
      ],
      analystChecks: ["Verify the cited source."],
      openUncertainties: ["Current operating conditions are unknown."],
    };

    const result = sanitizeBrief(generated, ["event-1"]);

    expect(result.brief.evidence).toEqual([
      {
        statement: "This statement has one supported citation.",
        eventIds: ["event-1"],
      },
    ]);
    expect(result.sanitization).toEqual({
      citationsRemoved: 2,
      evidenceRemoved: 1,
    });
  });

  it("detects route recommendations before they reach the analyst", () => {
    const generated: GeneratedBrief = {
      summary: "The analyst should reroute the vessel immediately.",
      evidence: [],
      analystChecks: [],
      openUncertainties: [],
    };

    expect(containsRouteRecommendation(generated)).toBe(true);
  });
});
