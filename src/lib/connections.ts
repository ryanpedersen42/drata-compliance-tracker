import { db } from "@/lib/db";
import { testSlackConnection } from "@/lib/slack";
import { testJiraConnection } from "@/lib/jira";
import { testLinearConnection } from "@/lib/linear";

export interface SlackCredentials {
  token: string;
}
export interface JiraCredentials {
  baseUrl: string;
  email: string;
  apiToken: string;
}
export interface LinearCredentials {
  apiKey: string;
}

type ChannelType = "SLACK" | "JIRA" | "LINEAR";

export function parseCredentials<T>(connection: { credentialsJson: string }): T {
  return JSON.parse(connection.credentialsJson) as T;
}

export function validateCredentials(channelType: ChannelType, credentials: Record<string, unknown>): string | null {
  if (channelType === "SLACK" && !credentials.token) return "Slack connections need a bot token.";
  if (channelType === "JIRA" && (!credentials.baseUrl || !credentials.email || !credentials.apiToken)) {
    return "Jira connections need a base URL, email, and API token.";
  }
  if (channelType === "LINEAR" && !credentials.apiKey) return "Linear connections need an API key.";
  return null;
}

export async function getLinearApiKey(connectionId: string): Promise<string> {
  const connection = await db.connection.findUnique({ where: { id: connectionId } });
  if (!connection || connection.channelType !== "LINEAR") throw new Error("Not a Linear connection");
  return parseCredentials<LinearCredentials>(connection).apiKey;
}

export async function testConnectionById(id: string): Promise<{ ok: true; detail: string } | { ok: false; error: string }> {
  const connection = await db.connection.findUnique({ where: { id } });
  if (!connection) return { ok: false, error: "Connection not found" };

  if (connection.channelType === "SLACK") {
    const { token } = parseCredentials<SlackCredentials>(connection);
    const result = await testSlackConnection(token);
    return result.ok ? { ok: true, detail: `Connected to workspace "${result.team}".` } : result;
  }
  if (connection.channelType === "JIRA") {
    const config = parseCredentials<JiraCredentials>(connection);
    const result = await testJiraConnection(config);
    return result.ok ? { ok: true, detail: `Connected as ${result.user}.` } : result;
  }
  const { apiKey } = parseCredentials<LinearCredentials>(connection);
  const result = await testLinearConnection(apiKey);
  return result.ok ? { ok: true, detail: `Connected as ${result.user}.` } : result;
}
