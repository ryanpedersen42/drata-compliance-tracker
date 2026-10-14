import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const rows = await db.monitoringTest.findMany({
    where: { provider: { not: null } },
    distinct: ["provider"],
    select: { provider: true },
    orderBy: { provider: "asc" },
  });
  return NextResponse.json(rows.map((r) => r.provider));
}
