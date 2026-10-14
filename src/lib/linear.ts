// Minimal Linear GraphQL API client, authenticated with a personal/workspace
// API key. https://developers.linear.app/docs/graphql/working-with-the-graphql-api
//
// Unlike most APIs, Linear's key goes in the Authorization header with no
// "Bearer " prefix.

const ENDPOINT = "https://api.linear.app/graphql";

async function graphql<T>(apiKey: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (!res.ok || json.errors) {
    const message = json.errors?.map((e: { message: string }) => e.message).join("; ") ?? res.statusText;
    throw new Error(`Linear API error: ${message}`);
  }
  return json.data as T;
}

export interface LinearTeam {
  id: string;
  key: string;
  name: string;
}

export interface LinearProject {
  id: string;
  name: string;
}

export async function listTeams(apiKey: string): Promise<LinearTeam[]> {
  const data = await graphql<{ teams: { nodes: LinearTeam[] } }>(
    apiKey,
    `query { teams { nodes { id key name } } }`,
  );
  return data.teams.nodes;
}

/** Projects scoped to a team (a Linear Project can span teams, but this is the set relevant to issues filed against this team). */
export async function listProjects(apiKey: string, teamId: string): Promise<LinearProject[]> {
  const data = await graphql<{ team: { projects: { nodes: LinearProject[] } } }>(
    apiKey,
    `query($teamId: String!) {
      team(id: $teamId) { projects { nodes { id name } } }
    }`,
    { teamId },
  );
  return data.team.projects.nodes;
}

/** Creates an issue. Returns Linear's internal issue id (needed for later comments), plus its human-readable identifier (e.g. "ENG-123"). */
export async function createIssue(
  apiKey: string,
  opts: { teamId: string; projectId?: string; title: string; description: string },
): Promise<{ id: string; identifier: string }> {
  const data = await graphql<{ issueCreate: { success: boolean; issue: { id: string; identifier: string } } }>(
    apiKey,
    `mutation($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id identifier }
      }
    }`,
    {
      input: {
        teamId: opts.teamId,
        ...(opts.projectId ? { projectId: opts.projectId } : {}),
        title: opts.title,
        description: opts.description,
      },
    },
  );
  if (!data.issueCreate.success) throw new Error("Linear issueCreate did not succeed");
  return data.issueCreate.issue;
}

export async function addComment(apiKey: string, issueId: string, body: string): Promise<void> {
  const data = await graphql<{ commentCreate: { success: boolean } }>(
    apiKey,
    `mutation($input: CommentCreateInput!) {
      commentCreate(input: $input) { success }
    }`,
    { input: { issueId, body } },
  );
  if (!data.commentCreate.success) throw new Error("Linear commentCreate did not succeed");
}

export async function testLinearConnection(apiKey: string): Promise<{ ok: true; user: string } | { ok: false; error: string }> {
  try {
    const data = await graphql<{ viewer: { name: string } }>(apiKey, `query { viewer { name } }`);
    return { ok: true, user: data.viewer.name };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
