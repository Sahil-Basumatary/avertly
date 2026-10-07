import { NextResponse } from "next/server";
import { z } from "zod";

import { createBrief } from "@/lib/brief-service";

const briefRequestSchema = z
  .object({
    routeId: z.enum(["suez", "cape"]),
  })
  .strict();

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = briefRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "routeId must be either \"suez\" or \"cape\".",
        },
      },
      { status: 400 },
    );
  }

  const brief = await createBrief(parsed.data.routeId);
  return NextResponse.json(brief, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
