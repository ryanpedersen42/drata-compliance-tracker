import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json();
  const { tagId, entityType, entityId } = body as { tagId?: string; entityType?: "CONTROL" | "TEST"; entityId?: string };

  if (!tagId || !entityType || !entityId) {
    return NextResponse.json({ error: "tagId, entityType, and entityId are required." }, { status: 400 });
  }
  if (entityType !== "CONTROL" && entityType !== "TEST") {
    return NextResponse.json({ error: "entityType must be CONTROL or TEST." }, { status: 400 });
  }

  try {
    const assignment = await db.tagAssignment.create({
      data: {
        tagId,
        entityType,
        controlId: entityType === "CONTROL" ? entityId : null,
        testId: entityType === "TEST" ? entityId : null,
      },
    });
    return NextResponse.json(assignment, { status: 201 });
  } catch {
    return NextResponse.json({ error: "That tag is already assigned." }, { status: 409 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id query param is required." }, { status: 400 });
  }
  await db.tagAssignment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
