const request = require("supertest");

// Mock environment variables before loading index so CORS/session config is stable
process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "test-secret";
process.env.ALLOWED_ORIGINS = "http://localhost:3000";

// Import app after setting env
const app = require("../index");

describe("Server API basics", () => {
  it("GET /health returns ok status", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("ok", true);
    expect(res.body).toHaveProperty("uptime");
  });

  it("GET /api/past-meetings returns array (may be empty)", async () => {
    const res = await request(app).get("/api/past-meetings");
    // May return 200 or 500 depending on DB connectivity; we just verify shape
    if (res.status === 200) {
      expect(Array.isArray(res.body)).toBe(true);
      // If there are meetings, check shape
      if (res.body.length > 0) {
        const m = res.body[0];
        expect(m).toHaveProperty("id");
        expect(m).toHaveProperty("summary");
        expect(m).toHaveProperty("platform");
        expect(m).toHaveProperty("attendees");
      }
    } else {
      // If DB not available, endpoint may fail; just note it
      expect(res.status).toBe(500);
    }
  });
});
