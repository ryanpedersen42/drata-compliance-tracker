import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateCredentials } from "@/lib/connections";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (body.credentials) {
    const connection = await db.connection.findUnique({ where: { id } });
    if (!connection) return NextResponse.json({ error: "Connection not found." }, { status: 404 });
    const validationError = validateCredentials(connection.channelType, body.credentials);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    data.credentialsJson = JSON.stringify(body.credentials);
  }

  try {
    const connection = await db.connection.update({
      where: { id },
      data,
      select: { id: true, name: true, channelType: true, createdAt: true },
    });
    return NextResponse.json(connection);
  } catch {
    return NextResponse.json({ error: "A connection with that name already exists." }, { status: 409 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ruleCount = await db.notificationRule.count({ where: { connectionId: id } });
  if (ruleCount > 0) {
    return NextResponse.json(
      { error: `${ruleCount} notification rule(s) use this connection. Delete or reassign them first.` },
      { status: 409 },
    );
  }
  await db.connection.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
