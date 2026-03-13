import { describe, expect, it } from "vitest";
import { app } from "./app.ts";

describe("GET /api/health", () => {
  it("returns 200 with { ok: true }", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("sets CORS header for the Vite dev origin", async () => {
    const res = await app.request("/api/health", {
      headers: { Origin: "http://localhost:5173" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:5173",
    );
  });

  it("does not set CORS header for unknown origins", async () => {
    const res = await app.request("/api/health", {
      headers: { Origin: "http://evil.example.com" },
    });
    expect(res.headers.get("access-control-allow-origin")).not.toBe(
      "http://evil.example.com",
    );
  });
});
