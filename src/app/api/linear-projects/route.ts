import { NextResponse } from "next/server";
import { getLinearApiKey } from "@/lib/connections";
import { listProjects } from "@/lib/linear";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const connectionId = searchParams.get("connectionId");
  const teamId = searchParams.get("teamId");
  if (!connectionId || !teamId) {
    return NextResponse.json({ error: "connectionId and teamId query params are required." }, { status: 400 });
  }
  try {
    const apiKey = await getLinearApiKey(connectionId);
    const projects = await listProjects(apiKey, teamId);
    return NextResponse.json(projects);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
