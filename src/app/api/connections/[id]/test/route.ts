import { NextResponse } from "next/server";
import { testConnectionById } from "@/lib/connections";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await testConnectionById(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
