import { database } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await database.query("SELECT 1");
    return Response.json({ status: "ok", database: "available", timestamp: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ status: "degraded", database: "unavailable", timestamp: new Date().toISOString() }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
