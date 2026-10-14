// Shared between the server (building real notification content) and the
// client (the rule-editor form) - no server-only imports here.

export type TemplateVars = {
  code: string;
  name: string;
  label: string;
  status: string;
  reasonCode: string;
  reasonDetail: string;
  workspace: string;
  tags: string;
  entityType: string;
  providerName: string;
  failureCount: string;
  failureDetails: string;
  ruleName: string;
};

export const TEMPLATE_FIELDS: { key: keyof TemplateVars; label: string }[] = [
  { key: "label", label: "Label (code — name)" },
  { key: "code", label: "Code" },
  { key: "name", label: "Name" },
  { key: "status", label: "Status" },
  { key: "reasonCode", label: "Reason code" },
  { key: "reasonDetail", label: "Reason detail" },
  { key: "workspace", label: "Workspace" },
  { key: "tags", label: "Tags" },
  { key: "entityType", label: "Entity type" },
  { key: "providerName", label: "Provider (AWS/Azure/GCP/...)" },
  { key: "failureCount", label: "Failing resource count" },
  { key: "failureDetails", label: "Failing resources (list)" },
  { key: "ruleName", label: "Rule name" },
];

export const DEFAULT_TITLE_TEMPLATE = "[Compliance] {{label}} is failing";

// "## " and "- " are a lightweight markdown-ish convention understood both
// by Linear/Slack (plain markdown) and by Jira (translated into real
// headings/bullet lists - see textToADF in src/lib/jira.ts).
export const DEFAULT_DESCRIPTION_TEMPLATE = [
  'Triggered by notification rule "{{ruleName}}".',
  "",
  "## Details",
  "- Entity: {{label}} ({{entityType}})",
  "- Status: {{status}}",
  "- Reason: {{reasonDetail}}",
  "- Workspace: {{workspace}}",
  "- Tags: {{tags}}",
  "- Provider: {{providerName}}",
  "",
  "## Failing resources ({{failureCount}})",
  "{{failureDetails}}",
].join("\n");

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key as keyof TemplateVars] ?? "");
}
