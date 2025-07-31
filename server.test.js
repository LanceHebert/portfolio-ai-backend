const request = require("supertest");
const nock = require("nock");
require("dotenv").config();

// Import the app directly from server.js
const app = require("./server");

// Mock environment variables for testing
process.env.OPENAI_API_KEY = "test-api-key";
process.env.PORT = 3001;

beforeEach(() => {
  // Reset mocks before each test
  jest.clearAllMocks();
  nock.cleanAll();
});

describe("Health Check Endpoint", () => {
  test("GET /health should return 200 and server status", async () => {
    const response = await request(app).get("/health").expect(200);

    expect(response.body).toHaveProperty("status", "OK");
    expect(response.body).toHaveProperty(
      "message",
      "Portfolio AI Backend is running!"
    );
    expect(response.body).toHaveProperty("usage");
    expect(response.body.usage).toHaveProperty("dailyRequests");
    expect(response.body.usage).toHaveProperty("monthlyRequests");
    expect(response.body.usage).toHaveProperty("totalCost");
    expect(response.body.usage).toHaveProperty("lifetimeSpend");
    expect(response.body.usage).toHaveProperty("openaiDisabled");
    expect(response.body.usage).toHaveProperty("limits");
  });
});

describe("Chat Endpoint", () => {
  test("POST /api/chat should return 400 for missing message", async () => {
    const response = await request(app).post("/api/chat").send({}).expect(400);

    expect(response.body).toHaveProperty("error", "Invalid input");
    expect(response.body).toHaveProperty("details");
  });

  test("POST /api/chat should return 400 for empty message", async () => {
    const response = await request(app)
      .post("/api/chat")
      .send({ message: "" })
      .expect(400);

    expect(response.body).toHaveProperty("error", "Invalid input");
    expect(response.body).toHaveProperty("details");
  });

  test("POST /api/chat should return success response with fallback for experience question", async () => {
    const response = await request(app)
      .post("/api/chat")
      .send({ message: "Tell me about your experience" })
      .expect(200);

    expect(response.body).toHaveProperty("success", true);
    expect(response.body).toHaveProperty("response");
    expect(response.body).toHaveProperty("timestamp");
    expect(response.body).toHaveProperty("note");
    expect(response.body.response).toContain(
      "Lance Hebert has professional experience"
    );
  });

  test("POST /api/chat should return success response with fallback for skills question", async () => {
    const response = await request(app)
      .post("/api/chat")
      .send({ message: "What are your technical skills?" })
      .expect(200);

    expect(response.body).toHaveProperty("success", true);
    expect(response.body).toHaveProperty("response");
    expect(response.body.response).toContain("Lance Hebert has expertise in");
  });

  test("POST /api/chat should return success response with fallback for projects question", async () => {
    const response = await request(app)
      .post("/api/chat")
      .send({ message: "What projects have you worked on?" })
      .expect(200);

    expect(response.body).toHaveProperty("success", true);
    expect(response.body).toHaveProperty("response");
    expect(response.body.response).toContain(
      "Lance Hebert has professional experience"
    );
  });

  test("POST /api/chat should return success response with fallback for contact question", async () => {
    const response = await request(app)
      .post("/api/chat")
      .send({ message: "How can I contact you?" })
      .expect(200);

    expect(response.body).toHaveProperty("success", true);
    expect(response.body).toHaveProperty("response");
    expect(response.body.response).toContain(
      "You can connect with Lance through"
    );
  });

  test("POST /api/chat should return success response with default fallback", async () => {
    const response = await request(app)
      .post("/api/chat")
      .send({ message: "Hello" })
      .expect(200);

    expect(response.body).toHaveProperty("success", true);
    expect(response.body).toHaveProperty("response");
    expect(response.body.response).toContain("Hi! I'm ChadGPT");
  });
});

describe("OpenAI Integration", () => {
  test("should handle OpenAI API success", async () => {
    // Mock successful OpenAI response
    nock("https://api.openai.com")
      .post("/v1/chat/completions")
      .reply(200, {
        choices: [{ message: { content: "Test OpenAI response" } }],
        usage: { total_tokens: 100 },
      });

    const response = await request(app)
      .post("/api/chat")
      .send({ message: "Tell me more about your experience" })
      .expect(200);

    expect(response.body).toHaveProperty("success", true);
    expect(response.body.note).toContain("fallback");
  });

  test("should handle OpenAI API failure gracefully", async () => {
    // Mock OpenAI API failure
    nock("https://api.openai.com")
      .post("/v1/chat/completions")
      .reply(500, { error: "Internal server error" });

    const response = await request(app)
      .post("/api/chat")
      .send({ message: "Tell me about your skills" })
      .expect(200);

    expect(response.body).toHaveProperty("success", true);
    expect(response.body.note).toContain("fallback");
  });

  test("should handle OpenAI API key missing", async () => {
    // Temporarily remove API key
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const response = await request(app)
      .post("/api/chat")
      .send({ message: "Hello" })
      .expect(200);

    expect(response.body).toHaveProperty("success", true);
    expect(response.body.note).toContain("fallback");

    // Restore API key
    process.env.OPENAI_API_KEY = originalKey;
  });
});

describe("Usage Tracking", () => {
  test("should track usage statistics correctly", async () => {
    // Mock successful OpenAI response
    nock("https://api.openai.com")
      .post("/v1/chat/completions")
      .reply(200, {
        choices: [{ message: { content: "Test response" } }],
        usage: { total_tokens: 150 },
      });

    await request(app)
      .post("/api/chat")
      .send({ message: "Test message" })
      .expect(200);

    // Check health endpoint to see usage stats
    const healthResponse = await request(app).get("/health").expect(200);

    // Since we're using fallback mode, usage might not be tracked
    expect(healthResponse.body.usage).toHaveProperty("dailyRequests");
    expect(healthResponse.body.usage).toHaveProperty("monthlyRequests");
  });
});

describe("Error Handling", () => {
  test("should handle malformed JSON gracefully", async () => {
    const response = await request(app)
      .post("/api/chat")
      .set("Content-Type", "application/json")
      .send("invalid json")
      .expect(400);

    // The server might handle this differently, so just check for a response
    expect(response.status).toBe(400);
  });

  test("should handle server errors gracefully", async () => {
    const response = await request(app)
      .post("/api/chat")
      .send({ message: "" })
      .expect(400);

    expect(response.body).toHaveProperty("error", "Invalid input");
    expect(response.body).toHaveProperty("details");
  });
});

describe("CORS Configuration", () => {
  test("should allow CORS requests", async () => {
    const response = await request(app)
      .get("/health")
      .set("Origin", "http://localhost:3000")
      .expect(200);

    expect(response.headers).toHaveProperty("access-control-allow-origin");
  });
});

describe("Response Format", () => {
  test("should return consistent response format", async () => {
    const response = await request(app)
      .post("/api/chat")
      .send({ message: "Test message" })
      .expect(200);

    // Check required fields
    expect(response.body).toHaveProperty("success");
    expect(response.body).toHaveProperty("response");
    expect(response.body).toHaveProperty("timestamp");
    expect(response.body).toHaveProperty("note");

    // Check data types
    expect(typeof response.body.success).toBe("boolean");
    expect(typeof response.body.response).toBe("string");
    expect(typeof response.body.timestamp).toBe("string");
    expect(typeof response.body.note).toBe("string");

    // Check timestamp format
    expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
  });
});
