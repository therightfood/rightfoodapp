import { describe, test, expect } from "bun:test";
import { api, authenticatedApi, signUpTestUser, expectStatus, connectWebSocket, connectAuthenticatedWebSocket, waitForMessage } from "./helpers";

describe("API Integration Tests", () => {
  // Shared state for chaining tests (e.g., created resource IDs, auth tokens)
  let authToken: string;

  test("Sign up test user", async () => {
    const { token } = await signUpTestUser();
    authToken = token;
    expect(authToken).toBeDefined();
  });

  describe("Profile endpoints", () => {
    test("GET /api/profile - should return user profile when authenticated", async () => {
      const res = await authenticatedApi("/api/profile", authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data).toHaveProperty("id");
      expect(data).toHaveProperty("user_id");
      expect(data).toHaveProperty("disclaimer_acknowledged");
      expect(data).toHaveProperty("onboarding_completed");
    });

    test("GET /api/profile - should return 401 when not authenticated", async () => {
      const res = await api("/api/profile");
      await expectStatus(res, 401);
    });

    test("PUT /api/profile - should update user profile when authenticated", async () => {
      const res = await authenticatedApi("/api/profile", authToken, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disclaimer_acknowledged: true,
          medication: "Aspirin",
          dose_mg: 100,
          weight_kg: 70,
          height_cm: 180,
          age: 30,
          gender: "M",
          country: "US",
          onboarding_completed: true,
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data).toHaveProperty("id");
      expect(data).toHaveProperty("user_id");
      expect(data.medication).toBe("Aspirin");
    });

    test("PUT /api/profile - should accept partial updates", async () => {
      const res = await authenticatedApi("/api/profile", authToken, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          age: 35,
          country: "CA",
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.age).toBe(35);
      expect(data.country).toBe("CA");
    });

    test("PUT /api/profile - should return 401 when not authenticated", async () => {
      const res = await api("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disclaimer_acknowledged: true }),
      });
      await expectStatus(res, 401);
    });
  });
});
