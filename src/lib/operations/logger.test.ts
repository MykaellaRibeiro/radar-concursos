import { afterEach, describe, expect, it, vi } from "vitest";
import { operationalLog } from "./logger";

describe("operationalLog", () => {
  afterEach(() => vi.restoreAllMocks());

  it("redacts sensitive fields and bearer values", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    operationalLog("info", "test", { authorization: "Bearer super-secret", nested: { apiKey: "secret" }, note: "Bearer visible-token" });
    const output = String(info.mock.calls[0]?.[0]);
    expect(output).not.toContain("super-secret");
    expect(output).not.toContain("visible-token");
    expect(output).toContain("[REDACTED]");
  });
});
