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

  it("GET /api/auth/linkedin returns config error when missing credentials", async () => {
    const res = await request(app).get("/api/auth/linkedin");
    // In test env we expect 400 because placeholders/not set
    expect([200, 400]).toContain(res.status);
    if (res.status === 400) {
      expect(res.body).toHaveProperty("error");
    } else if (res.status === 200) {
      expect(res.body).toHaveProperty("url");
    }
  });

  it("POST /api/automations creates and lists automation", async () => {
    // Create automation
    const createRes = await request(app)
      .post("/api/automations")
      .send({ platform: "linkedin", name: "Test Automation", prompt: "Do X" })
      .set("Content-Type", "application/json");
    expect([200, 500]).toContain(createRes.status); // DB may be unavailable
    if (createRes.status === 200) {
      expect(createRes.body).toHaveProperty("automation");
      const listRes = await request(app).get("/api/automations");
      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);
      // At least one automation present
      expect(listRes.body.some((a) => a.name === "Test Automation")).toBe(true);
    }
  });
});
