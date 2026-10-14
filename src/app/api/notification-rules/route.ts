import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const rules = await db.notificationRule.findMany({
    include: { tag: true, connection: { select: { id: true, name: true, channelType: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(rules);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, tagId, workspaceId, entityType, provider, connectionId, config } = body as {
    name?: string;
    tagId?: string | null;
    workspaceId?: string | null;
    entityType?: "CONTROL" | "TEST" | null;
    provider?: string | null;
    connectionId?: string;
    config?: Record<string, unknown>;
  };

  if (!name?.trim() || !connectionId || !config) {
    return NextResponse.json({ error: "name, connectionId, and config are required." }, { status: 400 });
  }

  const connection = await db.connection.findUnique({ where: { id: connectionId } });
  if (!connection) {
    return NextResponse.json({ error: "Connection not found." }, { status: 404 });
  }
  if (connection.channelType === "SLACK" && !config.channel) {
    return NextResponse.json({ error: "Slack rules need a channel." }, { status: 400 });
  }
  if (connection.channelType === "JIRA" && (!config.projectKey || !config.issueType)) {
    return NextResponse.json({ error: "Jira rules need a project key and issue type." }, { status: 400 });
  }
  if (connection.channelType === "LINEAR" && !config.teamId) {
    return NextResponse.json({ error: "Linear rules need a team." }, { status: 400 });
  }

  const rule = await db.notificationRule.create({
    data: {
      name: name.trim(),
      tagId: tagId || null,
      workspaceId: workspaceId || null,
      entityType: entityType || null,
      provider: provider || null,
      connectionId,
      configJson: JSON.stringify(config),
    },
  });
  return NextResponse.json(rule, { status: 201 });
}
