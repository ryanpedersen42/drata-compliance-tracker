import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const workspaces = await db.workspace.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(workspaces);
}
