import { db } from "@/lib/db";

/** The most recent successful sync, whose snapshots represent "current" status. */
export async function getLatestCheckRun() {
  return db.checkRun.findFirst({
    where: { status: { in: ["SUCCEEDED", "SUCCEEDED_WITH_WARNINGS"] } },
    orderBy: { startedAt: "desc" },
  });
}
