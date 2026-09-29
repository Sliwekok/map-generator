// Tiny fetch wrapper for the JSON API.
export class ApiError extends Error {
  constructor(public status: number, public code: string, public data: Record<string, unknown> = {}) {
    super(code);
  }
}

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: "same-origin",
      ...rest,
      headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(0, "network");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, String(data?.error ?? res.statusText), data);
  return data as T;
}
