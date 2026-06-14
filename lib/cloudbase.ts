// CloudBase HTTP API client — uses API Key (Bearer token) for authentication.
// No @cloudbase/node-sdk needed. Works with the API Key from CloudBase Console.

const envId = process.env.CLOUDBASE_ENV_ID;
const apiKey = process.env.CLOUDBASE_API_KEY;

const BASE_URL = `https://${envId}.api.tcloudbasegateway.com/v1/database/instances/(default)/databases/(default)`;

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

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`CloudBase API error: ${response.status} ${response.statusText}`);
  }

  const data: QueryResult<T> = await response.json();
  return data.list;
}

