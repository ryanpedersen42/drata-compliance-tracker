// Minimal Jira Cloud REST API (v3) client, authenticated with an email +
// API token (Basic auth). https://developer.atlassian.com/cloud/jira/platform/rest/v3/

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

function authHeader(config: JiraConfig): string {
  return `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString("base64")}`;
}

/**
 * Turns the plain-text template output into real Atlassian Document Format
 * structure instead of one paragraph per line: a line starting with "## "
 * becomes a heading, consecutive "- " lines become one bullet list, blank
 * lines just separate blocks, everything else is an ordinary paragraph. This
 * is the same lightweight convention the default description template (and
 * the failure-resource list) already use, so it renders properly without
 * requiring any Jira-specific authoring.
 */
function textToADF(text: string) {
  const lines = text.split("\n");
  const content: Record<string, unknown>[] = [];
  let listItems: Record<string, unknown>[] = [];

  const flushList = () => {
    if (listItems.length) {
      content.push({ type: "bulletList", content: listItems });
      listItems = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith("- ")) {
      listItems.push({
        type: "listItem",
        content: [{ type: "paragraph", content: [{ type: "text", text: line.slice(2) }] }],
      });
      continue;
    }
    flushList();

    if (line.startsWith("## ")) {
      content.push({ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: line.slice(3) }] });
    } else if (line.trim()) {
      content.push({ type: "paragraph", content: [{ type: "text", text: line }] });
    }
  }
  flushList();

  return { type: "doc", version: 1, content: content.length ? content : [{ type: "paragraph", content: [] }] };
}

async function request<T>(config: JiraConfig, path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${config.baseUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(config),
      "Content-Type": "application/json",
      Accept: "application/json",
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jira API error ${res.status}: ${body.slice(0, 500)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function createIssue(
  config: JiraConfig,
  opts: {
    projectKey: string;
    issueType: string;
    summary: string;
    description: string;
    labels?: string[];
    additionalFields?: Record<string, unknown>;
  },
): Promise<string> {
  const result = await request<{ key: string }>(config, "/rest/api/3/issue", {
    method: "POST",
    body: JSON.stringify({
      fields: {
        project: { key: opts.projectKey },
        issuetype: { name: opts.issueType },
        summary: opts.summary,
        description: textToADF(opts.description),
        ...(opts.labels?.length ? { labels: opts.labels } : {}),
        ...opts.additionalFields,
      },
    }),
  });
  return result.key;
}

export async function addComment(config: JiraConfig, issueKey: string, text: string): Promise<void> {
  await request(config, `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`, {
    method: "POST",
    body: JSON.stringify({ body: textToADF(text) }),
  });
}

export async function testJiraConnection(config: JiraConfig): Promise<{ ok: true; user: string } | { ok: false; error: string }> {
  try {
    const me = await request<{ displayName?: string; emailAddress?: string }>(config, "/rest/api/3/myself", { method: "GET" });
    return { ok: true, user: me.displayName ?? me.emailAddress ?? "unknown" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
