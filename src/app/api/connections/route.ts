import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateCredentials } from "@/lib/connections";

export async function GET() {
  const connections = await db.connection.findMany({
    select: { id: true, name: true, channelType: true, createdAt: true, _count: { select: { rules: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(connections);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, channelType, credentials } = body as {
    name?: string;
    channelType?: "SLACK" | "JIRA" | "LINEAR";
    credentials?: Record<string, unknown>;
  };

  if (!name?.trim() || !channelType || !credentials) {
    return NextResponse.json({ error: "name, channelType, and credentials are required." }, { status: 400 });
  }
  const validationError = validateCredentials(channelType, credentials);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const connection = await db.connection.create({
      data: { name: name.trim(), channelType, credentialsJson: JSON.stringify(credentials) },
      select: { id: true, name: true, channelType: true, createdAt: true },
    });
    return NextResponse.json(connection, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A connection with that name already exists." }, { status: 409 });
  }
}
