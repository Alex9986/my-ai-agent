// CloudBase HTTP API client — uses API Key (Bearer token) for authentication.
// No SDK needed. Works with the API Key from CloudBase Console.

const envId = process.env.CLOUDBASE_ENV_ID;
const apiKey = process.env.CLOUDBASE_API_KEY;

if (!envId || !apiKey) {
  throw new Error(
    "CloudBase 环境变量未配置。请在 .env.local 中设置 CLOUDBASE_ENV_ID 和 CLOUDBASE_API_KEY"
  );
}

const BASE_URL = `https://${envId}.api.tcloudbasegateway.com/v1/database/instances/(default)/databases/(default)`;
const HEADERS = {
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
};

interface QueryResult<T = Record<string, unknown>> {
  offset: number;
  limit: number;
  list: T[];
}

/**
 * Query a collection for documents matching the given filter.
 */
export async function queryCollection<T = Record<string, unknown>>(
  collectionName: string,
  filter: Record<string, unknown>
): Promise<T[]> {
  const query = encodeURIComponent(JSON.stringify(filter));
  const url = `${BASE_URL}/collections/${collectionName}/documents?query=${query}`;

  const response = await fetch(url, { headers: HEADERS });

  if (!response.ok) {
    throw new Error(`CloudBase API error: ${response.status} ${response.statusText}`);
  }

  const data: QueryResult<T> = await response.json();
  return data.list;
}

/**
 * Create a new document in a collection. Returns the generated document ID.
 */
export async function createDocument<T = Record<string, unknown>>(
  collectionName: string,
  data: T
): Promise<string> {
  const url = `${BASE_URL}/collections/${collectionName}/documents`;

  const response = await fetch(url, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ data: [data] }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`CloudBase createDocument error: ${response.status} ${err}`);
  }

  const result = await response.json();
  return result.insertedIds[0];
}

/**
 * Update an existing document by ID. Merges the provided fields.
 */
export async function updateDocument<T = Record<string, unknown>>(
  collectionName: string,
  documentId: string,
  data: Partial<T>
): Promise<void> {
  const url = `${BASE_URL}/collections/${collectionName}/documents/${documentId}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: HEADERS,
    body: JSON.stringify({ data }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`CloudBase updateDocument error: ${response.status} ${err}`);
  }
}

/**
 * Ensure a collection exists, creating it if necessary.
 * Safe to call repeatedly — returns 201 (created) or 400 (already exists).
 */
export async function ensureCollection(collectionName: string): Promise<void> {
  const url = `${BASE_URL}/collections`;

  await fetch(url, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ collectionName }),
  });
  // Ignore response — 201 = created, 400 = already exists, both fine
}

