import { describe, it, expect } from "bun:test";
import { Elysia } from "elysia";
import { healthPlugin } from "../src/modules/health/health.plugin";

describe("Health Plugin", () => {
  it("should return ok status", async () => {
    const app = new Elysia().use(healthPlugin);
    const response = await app.handle(new Request("http://localhost/health/"));
    
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
    expect(body.uptime).toBeDefined();
  });
});
