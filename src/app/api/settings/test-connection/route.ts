import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { DrataClient } from "@/lib/drata";

export async function POST() {
  const settings = await getSettings();
  if (!settings.drataApiKey) {
    return NextResponse.json({ ok: false, error: "No Drata API key configured yet." }, { status: 400 });
  }

  const client = new DrataClient(settings.drataApiKey);
  const result = await client.testConnection();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
