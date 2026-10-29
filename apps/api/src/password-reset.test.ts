import { describe, expect, it } from "vitest";
import { createPasswordResetToken, hashPasswordResetToken } from "./password-reset.js";

describe("password reset tokens", () => {
  it("creates a high-entropy token and stores only its one-way hash", () => {
    const first = createPasswordResetToken();
    const second = createPasswordResetToken();

    expect(first.token).not.toBe(second.token);
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.tokenHash).toBe(hashPasswordResetToken(first.token));
    expect(first.tokenHash).not.toContain(first.token);
  });

  it("hashes the same token consistently", () => {
    expect(hashPasswordResetToken("reset-token")).toBe(hashPasswordResetToken("reset-token"));
    expect(hashPasswordResetToken("reset-token")).not.toBe(hashPasswordResetToken("other-token"));
  });
});
