import { afterEach, describe, expect, it } from "vitest";
import { isCollectorEnabled } from "./collector-runtime";

describe("collector kill switches", () => {
  const original = process.env.ENABLE_PCI_COLLECTOR;
  afterEach(() => {
    if (original === undefined) delete process.env.ENABLE_PCI_COLLECTOR;
    else process.env.ENABLE_PCI_COLLECTOR = original;
  });

  it("defaults to enabled", () => {
    delete process.env.ENABLE_PCI_COLLECTOR;
    expect(isCollectorEnabled("pci_collector")).toBe(true);
  });

  it("accepts an operational kill switch", () => {
    process.env.ENABLE_PCI_COLLECTOR = "false";
    expect(isCollectorEnabled("pci_collector")).toBe(false);
  });
});
