import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveTargets, buildFailureVars } from "@/lib/notifications";
import { renderTemplate, DEFAULT_TITLE_TEMPLATE, DEFAULT_DESCRIPTION_TEMPLATE, type TemplateVars } from "@/lib/templateVars";

function sampleVars(): TemplateVars {
  return {
    code: "DCF-1",
    name: "Example Control",
    label: "DCF-1 — Example Control",
    status: "FAIL",
    reasonCode: "TEST_FAILED",
    reasonDetail: "Example Monitoring Test",
    workspace: "Example Workspace",
    tags: "example-tag",
    entityType: "Control",
    providerName: "AWS",
    failureCount: "2",
    failureDetails: "- example-bucket · us-east-1: Public access is enabled\n- another-bucket · us-west-2: Encryption disabled",
    ruleName: "Example Rule",
  };
}

export async function POST(request: Request) {
  const body = await request.json();
  const { tagId, workspaceId, entityType, provider, titleTemplate, descriptionTemplate } = body as {
    tagId?: string | null;
    workspaceId?: string | null;
    entityType?: "CONTROL" | "TEST" | null;
    provider?: string | null;
    titleTemplate?: string;
    descriptionTemplate?: string;
  };

  const latestRun = await db.checkRun.findFirst({
    where: { status: { in: ["SUCCEEDED", "SUCCEEDED_WITH_WARNINGS"] } },
    orderBy: { startedAt: "desc" },
  });

  let vars = sampleVars();
  let usingSampleData = true;

  if (latestRun) {
    const targets = await resolveTargets(
      { tagId: tagId || null, workspaceId: workspaceId || null, entityType: entityType || null, provider: provider || null },
      latestRun.id,
    );
    const failing = targets.find((t) => t.status === "FAIL");
    if (failing) {
      usingSampleData = false;
      const failureVars = await buildFailureVars(failing);
      vars = { ...failing.vars, ...failureVars, ruleName: "Example Rule" };
    }
  }

  return NextResponse.json({
    title: renderTemplate(titleTemplate || DEFAULT_TITLE_TEMPLATE, vars),
    description: renderTemplate(descriptionTemplate || DEFAULT_DESCRIPTION_TEMPLATE, vars),
    usingSampleData,
    sourceLabel: usingSampleData ? null : vars.label,
  });
}
