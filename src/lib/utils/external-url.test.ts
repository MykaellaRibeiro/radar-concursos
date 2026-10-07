import { describe, expect, it } from "vitest";
import { safeExternalUrl } from "./external-url";

describe("safeExternalUrl", () => {
  it("accepts only HTTP(S)", () => {
    expect(safeExternalUrl("https://example.org/documento.pdf")).toBe("https://example.org/documento.pdf");
    expect(safeExternalUrl("http://example.org")).toBe("http://example.org/");
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,unsafe")).toBeNull();
    expect(safeExternalUrl("not-a-url")).toBeNull();
  });
});
