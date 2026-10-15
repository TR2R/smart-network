import { NextRequest } from "next/server";
import { scanNetwork } from "@/lib/network";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = process.env.MONITOR_TOKEN;
  if (!token) return Response.json({ error: "MONITOR_TOKEN is not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${token}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const message = await scanNetwork();
    return Response.json({ ok: true, message, checkedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Scheduled network scan failed:", error);
    return Response.json({ error: "Network scan failed" }, { status: 500 });
  }
}
