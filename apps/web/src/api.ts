const API_ROOT = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(`${API_ROOT}${path}`, { ...options, headers });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = typeof payload === "object" && payload !== null && "error" in payload
      ? payload.error
      : null;
    const message = typeof error === "object" && error !== null && "message" in error &&
      typeof error.message === "string"
      ? error.message
      : `Request failed (${response.status})`;
    const code = typeof error === "object" && error !== null && "code" in error &&
      typeof error.code === "string"
      ? error.code
      : "REQUEST_FAILED";
    throw new ApiError(message, response.status, code);
  }
  return payload as T;
}

export function imageUrl(url: string): string {
  if (url.startsWith("/")) return `${API_ROOT}${url}`;
  return url;
}
