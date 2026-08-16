/**
 * Minimal Lark Base (Bitable) API client.
 *
 * Handles:
 *  - tenant_access_token retrieval + in-memory caching (tokens last ~2hrs)
 *  - creating records in a table
 *  - creating linked child records against a parent record
 *
 * Docs: https://open.larksuite.com/document/server-docs/docs/bitable-v1/app-table-record/create
 * (Use open.feishu.cn instead of open.larksuite.com if your Lark tenant is on the China domain.)
 */

const LARK_DOMAIN = process.env.LARK_DOMAIN || "https://open.larksuite.com";

const APP_ID = process.env.LARK_APP_ID!;
const APP_SECRET = process.env.LARK_APP_SECRET!;
const BASE_APP_TOKEN = process.env.LARK_BASE_APP_TOKEN!; // the Base's "app_token" (from its URL)

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getTenantAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }

  const res = await fetch(`${LARK_DOMAIN}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
  });

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`Lark auth failed: ${data.msg} (code ${data.code})`);
  }

  cachedToken = {
    token: data.tenant_access_token,
    // expire field is in seconds; refresh a little early
    expiresAt: Date.now() + data.expire * 1000,
  };

  return cachedToken.token;
}

async function larkFetch(path: string, init: RequestInit = {}) {
  const token = await getTenantAccessToken();
  const res = await fetch(`${LARK_DOMAIN}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`Lark API error at ${path}: ${data.msg} (code ${data.code})`);
  }
  return data;
}

/** Create a single record in a Bitable table. Returns the new record_id. */
export async function createRecord(
  tableId: string,
  fields: Record<string, unknown>
): Promise<string> {
  const data = await larkFetch(
    `/open-apis/bitable/v1/apps/${BASE_APP_TOKEN}/tables/${tableId}/records`,
    {
      method: "POST",
      body: JSON.stringify({ fields }),
    }
  );
  return data.data.record.record_id;
}

/** Batch-create multiple records in one call (used for buyer reference rows). */
export async function batchCreateRecords(
  tableId: string,
  records: Record<string, unknown>[]
): Promise<string[]> {
  if (records.length === 0) return [];
  const data = await larkFetch(
    `/open-apis/bitable/v1/apps/${BASE_APP_TOKEN}/tables/${tableId}/records/batch_create`,
    {
      method: "POST",
      body: JSON.stringify({ records: records.map((fields) => ({ fields })) }),
    }
  );
  return data.data.records.map((r: { record_id: string }) => r.record_id);
}

/** Update fields on an existing record (used to write back the AI summary). */
export async function updateRecord(
  tableId: string,
  recordId: string,
  fields: Record<string, unknown>
): Promise<void> {
  await larkFetch(
    `/open-apis/bitable/v1/apps/${BASE_APP_TOKEN}/tables/${tableId}/records/${recordId}`,
    {
      method: "PUT",
      body: JSON.stringify({ fields }),
    }
  );
}

/** List records from a table, optionally filtered/sorted. Used for the leads table view. */
export async function listRecords(
  tableId: string,
  params: { pageSize?: number; pageToken?: string } = {}
): Promise<{ items: Array<{ record_id: string; fields: Record<string, unknown> }>; hasMore: boolean; pageToken?: string }> {
  const qs = new URLSearchParams();
  qs.set("page_size", String(params.pageSize ?? 50));
  if (params.pageToken) qs.set("page_token", params.pageToken);

  const data = await larkFetch(
    `/open-apis/bitable/v1/apps/${BASE_APP_TOKEN}/tables/${tableId}/records?${qs.toString()}`
  );
  return {
    items: data.data.items || [],
    hasMore: !!data.data.has_more,
    pageToken: data.data.page_token,
  };
}
