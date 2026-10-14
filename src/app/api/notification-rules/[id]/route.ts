import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if (body.tagId !== undefined) data.tagId = body.tagId || null;
  if (body.workspaceId !== undefined) data.workspaceId = body.workspaceId || null;
  if (body.entityType !== undefined) data.entityType = body.entityType || null;
  if (body.provider !== undefined) data.provider = body.provider || null;
  if (typeof body.connectionId === "string" && body.connectionId) data.connectionId = body.connectionId;
  if (body.config) data.configJson = JSON.stringify(body.config);

  const rule = await db.notificationRule.update({ where: { id }, data });
  return NextResponse.json(rule);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.notificationRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
