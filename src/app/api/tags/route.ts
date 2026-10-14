import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const tags = await db.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { assignments: true } } },
  });
  return NextResponse.json(tags);
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Tag name is required." }, { status: 400 });
  }

  const color = typeof body.color === "string" && body.color.trim() ? body.color.trim() : undefined;

  try {
    const tag = await db.tag.create({ data: { name, ...(color ? { color } : {}) } });
    return NextResponse.json(tag, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A tag with that name already exists." }, { status: 409 });
  }
}
