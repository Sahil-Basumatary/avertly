import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getEventFeed } from "@/lib/event-service";

const routeIdSchema = z.enum(["suez", "cape"]);

export async function GET(request: NextRequest) {
  const routeId = routeIdSchema.safeParse(
    request.nextUrl.searchParams.get("routeId"),
  );

  if (!routeId.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_ROUTE",
          message: "routeId must be either \"suez\" or \"cape\".",
        },
      },
      { status: 400 },
    );
  }

  const feed = await getEventFeed(routeId.data);
  return NextResponse.json(feed, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
