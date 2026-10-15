export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fields?: Record<string, string>; status: number };

/** JSON fetch for the app's own Route Handlers, with errors normalised for display. */
export async function apiFetch<T = unknown>(
  url: string,
  init: { method: "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown },
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method,
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    return { ok: false, error: "Network error. Check your connection and try again.", status: 0 };
  }

  if (response.status === 204) return { ok: true, data: undefined as T };
  const payload = (await response.json().catch(() => ({}))) as { error?: string; fields?: Record<string, string> };
  if (!response.ok) {
    return {
      ok: false,
      error: payload.error ?? "Something went wrong. Try again.",
      fields: payload.fields,
      status: response.status,
    };
  }
  return { ok: true, data: payload as T };
}
