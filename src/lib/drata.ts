// Thin client for Drata's public API v2 (https://developers.drata.com).
// Auth is a single API key sent as a Bearer token. Listing endpoints use
// cursor pagination: pass `cursor` from `pagination.cursor` until it's absent.

const BASE_URL = "https://public-api.drata.com/public/v2";

export class DrataApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`Drata API error ${status}: ${body.slice(0, 500)}`);
  }
}

interface Paginated<T> {
  data: T[];
  pagination?: { cursor?: string | null; totalCount?: number };
}

export interface DrataWorkspace {
  id: number;
  name: string;
  primary: boolean;
}

export interface DrataControlFlags {
  isReady?: boolean;
  hasPolicy?: boolean;
  hasPassingTest?: boolean;
  hasEvidence?: boolean;
  isMonitored?: boolean;
  [key: string]: unknown;
}

export interface DrataControl {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  flags?: DrataControlFlags;
  owners?: unknown[];
  frameworkTags?: unknown[];
  testIds?: (number | string)[];
  evidenceIds?: (number | string)[];
  [key: string]: unknown;
}

export interface DrataMonitoringTest {
  id: number;
  testId: string;
  name: string;
  checkResultStatus?: string | null;
  checkStatus?: string | null;
  testSource?: string | null;
  [key: string]: unknown;
}

export interface DrataPolicy {
  id: number;
  name: string;
  status?: string | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
  renewalDate?: string | null;
  version?: string | null;
  [key: string]: unknown;
}

export interface DrataEvidence {
  id: number;
  name: string;
  status: string;
  renewalDate?: string | null;
  [key: string]: unknown;
}

export interface DrataTestFailure {
  id: number | string;
  status?: string | null;
  providerName?: string | null;
  resourceName?: string | null;
  accountName?: string | null;
  resourceArn?: string | null;
  region?: string | null;
  cause?: string | null;
  [key: string]: unknown;
}

export class DrataClient {
  constructor(private apiKey: string) {}

  private async request<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new DrataApiError(res.status, body);
    }

    return (await res.json()) as T;
  }

  /** Fetches every page of a cursor-paginated list endpoint. */
  private async listAll<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T[]> {
    const results: T[] = [];
    let cursor: string | undefined;

    do {
      const page = await this.request<Paginated<T>>(path, { ...params, size: 500, cursor });
      results.push(...page.data);
      cursor = page.pagination?.cursor ?? undefined;
    } while (cursor);

    return results;
  }

  async listWorkspaces(): Promise<DrataWorkspace[]> {
    const page = await this.request<Paginated<DrataWorkspace> | DrataWorkspace[]>("/workspaces");
    return Array.isArray(page) ? page : page.data;
  }

  async listControls(workspaceId: number | string): Promise<DrataControl[]> {
    return this.listAll<DrataControl>(`/workspaces/${workspaceId}/controls`, {
      "expand[]": "flags",
      isEnabled: true,
    });
  }

  async listMonitoringTests(workspaceId: number | string): Promise<DrataMonitoringTest[]> {
    return this.listAll<DrataMonitoringTest>(`/workspaces/${workspaceId}/monitoring-tests`);
  }

  async listPolicies(): Promise<DrataPolicy[]> {
    return this.listAll<DrataPolicy>("/policies");
  }

  async listEvidence(workspaceId: number | string): Promise<DrataEvidence[]> {
    return this.listAll<DrataEvidence>(`/workspaces/${workspaceId}/evidence`);
  }

  /** The individual resources failing a monitoring test (e.g. specific S3 buckets, users, etc), not just the pass/fail verdict. */
  async listTestFailures(
    workspaceId: number | string,
    testId: string,
    limit = 10,
  ): Promise<{ items: DrataTestFailure[]; totalCount?: number }> {
    const page = await this.request<Paginated<DrataTestFailure>>(`/workspaces/${workspaceId}/monitoring-tests/${testId}/failures`, {
      size: limit,
      includeTotalCount: true,
    });
    return { items: page.data, totalCount: page.pagination?.totalCount };
  }

  /** Lightweight connectivity/credential check. */
  async testConnection(): Promise<{ ok: true; workspaceCount: number } | { ok: false; error: string }> {
    try {
      const workspaces = await this.listWorkspaces();
      return { ok: true, workspaceCount: workspaces.length };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
