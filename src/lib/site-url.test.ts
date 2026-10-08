import { afterEach, describe, expect, it } from "vitest";
import { siteUrl } from "./site-url";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
});

describe("siteUrl", () => {
  it("uses the configured public production origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://radar.example.com/path";
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(siteUrl()).toBe("https://radar.example.com");
  });

  it("never uses a localhost override when Vercel exposes the production domain", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "radar-concursos-one.vercel.app";
    expect(siteUrl()).toBe("https://radar-concursos-one.vercel.app");
  });

  it("keeps localhost for local development", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    delete process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.NEXT_PUBLIC_VERCEL_URL;
    delete process.env.VERCEL_URL;
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});
