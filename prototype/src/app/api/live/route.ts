import { NextResponse } from "next/server";
import { liveEnabled, models } from "@/lib/llm";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ enabled: liveEnabled(), models: models() });
}
