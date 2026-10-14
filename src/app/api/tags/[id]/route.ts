import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.color === "string" && body.color.trim()) data.color = body.color.trim();

  try {
    const tag = await db.tag.update({ where: { id }, data });
    return NextResponse.json(tag);
  } catch {
    return NextResponse.json({ error: "A tag with that name already exists." }, { status: 409 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.tag.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
