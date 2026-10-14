import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSettingsForClient } from "@/lib/settings";
import { rescheduleFromSettings } from "@/lib/scheduler";

export async function GET() {
  return NextResponse.json(await getSettingsForClient());
}

function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function PUT(request: Request) {
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (typeof body.drataApiKey === "string" && body.drataApiKey.trim()) {
    data.drataApiKey = body.drataApiKey.trim();
  }
  if (typeof body.scheduleEnabled === "boolean") {
    data.scheduleEnabled = body.scheduleEnabled;
  }
  if (Number.isInteger(body.scheduleHour) && body.scheduleHour >= 0 && body.scheduleHour <= 23) {
    data.scheduleHour = body.scheduleHour;
  }
  if (Number.isInteger(body.scheduleMinute) && body.scheduleMinute >= 0 && body.scheduleMinute <= 59) {
    data.scheduleMinute = body.scheduleMinute;
  }
  if (typeof body.scheduleTimezone === "string" && isValidTimeZone(body.scheduleTimezone)) {
    data.scheduleTimezone = body.scheduleTimezone;
  }

  await db.settings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });

  await rescheduleFromSettings();

  return NextResponse.json(await getSettingsForClient());
}
