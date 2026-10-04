import { NextResponse } from "next/server";
import { liveEnabled, MODELS } from "@/lib/llm";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ enabled: liveEnabled(), models: MODELS });
}
