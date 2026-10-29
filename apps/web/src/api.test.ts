import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("sends JSON with a bearer token and returns the response body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: "user-1" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await api<{ data: { id: string } }>(
      "/api/auth/me",
      { method: "POST", body: JSON.stringify({ email: "farmer@example.test" }) },
      "access-token",
    );

    expect(result.data.id).toBe("user-1");
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(options.headers).get("authorization")).toBe("Bearer access-token");
    expect(new Headers(options.headers).get("content-type")).toBe("application/json");
  });

  it("preserves a safe API error response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: { code: "SLOT_UNAVAILABLE", message: "Choose another time." } }),
    }));

    await expect(api("/api/consultations")).rejects.toMatchObject({
      status: 409,
      code: "SLOT_UNAVAILABLE",
      message: "Choose another time.",
    });
  });

  it("does not set a JSON content type for image uploads", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });
    vi.stubGlobal("fetch", fetchMock);
    const body = new FormData();
    body.append("subject", "crop");

    await api("/api/diagnoses", { method: "POST", body });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(options.headers).has("content-type")).toBe(false);
  });
});
