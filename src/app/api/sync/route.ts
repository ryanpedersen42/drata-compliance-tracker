import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runSync } from "@/lib/sync";

export async function GET() {
  const runs = await db.checkRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 10,
  });
  return NextResponse.json(runs);
}

export async function POST() {
  try {
    const checkRunId = await runSync("MANUAL");
    return NextResponse.json({ ok: true, checkRunId });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
