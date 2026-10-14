// Minimal Slack Web API client using a bot token (chat:write scope).
// https://api.slack.com/methods/chat.postMessage

interface SlackResult {
  ok: boolean;
  ts?: string;
  error?: string;
}

async function call(token: string, method: string, body: Record<string, unknown>): Promise<SlackResult> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as SlackResult;
  return json;
}

/**
 * Posts a structured alert using Block Kit: a header, a field grid, and a
 * colored side bar (via the legacy `attachments` wrapper, which is still the
 * supported way to get a color bar alongside Block Kit content).
 */
export async function postRichMessage(
  token: string,
  channel: string,
  opts: { fallbackText: string; headerText: string; color: string; fields: { label: string; value: string }[] },
): Promise<string> {
  const nonEmptyFields = opts.fields.filter((f) => f.value).slice(0, 10);
  const blocks = [
    { type: "header", text: { type: "plain_text", text: opts.headerText.slice(0, 150), emoji: true } },
    ...(nonEmptyFields.length
      ? [
          {
            type: "section",
            fields: nonEmptyFields.map((f) => ({ type: "mrkdwn", text: `*${f.label}*\n${f.value.slice(0, 500)}` })),
          },
        ]
      : []),
  ];

  const result = await call(token, "chat.postMessage", {
    channel,
    text: opts.fallbackText,
    attachments: [{ color: opts.color, blocks }],
  });
  if (!result.ok || !result.ts) throw new Error(`Slack chat.postMessage failed: ${result.error ?? "unknown error"}`);
  return result.ts;
}

/** Posts a threaded reply under an earlier message. */
export async function replyInThread(token: string, channel: string, threadTs: string, text: string): Promise<void> {
  const result = await call(token, "chat.postMessage", { channel, text, thread_ts: threadTs });
  if (!result.ok) throw new Error(`Slack thread reply failed: ${result.error ?? "unknown error"}`);
}

export async function testSlackConnection(token: string): Promise<{ ok: true; team: string } | { ok: false; error: string }> {
  try {
    const res = await fetch("https://slack.com/api/auth.test", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await res.json()) as { ok: boolean; team?: string; error?: string };
    if (!json.ok) return { ok: false, error: json.error ?? "unknown error" };
    return { ok: true, team: json.team ?? "unknown" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
