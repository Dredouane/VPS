import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "alinea",
    buildId: process.env.BUILD_ID ?? null,
    environment: process.env.ENVIRONMENT ?? "local",
    timestamp: new Date().toISOString(),
  });
}
