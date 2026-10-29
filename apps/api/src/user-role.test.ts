import { describe, expect, it } from "vitest";
import { isUserRole } from "./user-role.js";

describe("isUserRole", () => {
  it.each(["farmer", "agrovet", "expert", "admin"])("accepts %s", (role) => {
    expect(isUserRole(role)).toBe(true);
  });

  it.each(["Farmer", "", null, undefined, 1])("rejects %s", (role) => {
    expect(isUserRole(role)).toBe(false);
  });
});
