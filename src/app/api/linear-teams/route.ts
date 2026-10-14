import { NextResponse } from "next/server";
import { getLinearApiKey } from "@/lib/connections";
import { listTeams } from "@/lib/linear";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const connectionId = searchParams.get("connectionId");
  if (!connectionId) {
    return NextResponse.json({ error: "connectionId query param is required." }, { status: 400 });
  }
  try {
    const apiKey = await getLinearApiKey(connectionId);
    const teams = await listTeams(apiKey);
    return NextResponse.json(teams);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
