import { describe, test, expect } from "bun:test";
import { api, authenticatedApi, signUpTestUser, expectStatus, createTestFile } from "./helpers";

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

  describe("Scan endpoints", () => {
    let uploadedImageUrl: string;
    let analysisId: string;

    test("POST /api/scan/upload - should upload image successfully", async () => {
      const form = new FormData();
      form.append("file", createTestFile("test.jpg", "fake image data", "image/jpeg"));

      const res = await authenticatedApi("/api/scan/upload", authToken, {
        method: "POST",
        body: form,
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data).toHaveProperty("image_url");
      uploadedImageUrl = data.image_url;
    });

    test("POST /api/scan/upload - should return 401 when not authenticated", async () => {
      const form = new FormData();
      form.append("file", createTestFile("test.jpg", "fake image data", "image/jpeg"));

      const res = await api("/api/scan/upload", {
        method: "POST",
        body: form,
      });
      await expectStatus(res, 401);
    });

    test("POST /api/scan/upload - should return 400 when file is missing", async () => {
      const form = new FormData();

      const res = await authenticatedApi("/api/scan/upload", authToken, {
        method: "POST",
        body: form,
      });
      await expectStatus(res, 400);
    });

    test("POST /api/scan/analyze - should analyze image (may return 200 or 422 based on confidence)", async () => {
      const res = await authenticatedApi("/api/scan/analyze", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: uploadedImageUrl,
        }),
      });
      await expectStatus(res, 200, 422);
      const data = await res.json();
      expect(data).toHaveProperty("id");
      if (res.status === 200) {
        analysisId = data.id;
      }
    });

    test("POST /api/scan/analyze - should return 401 when not authenticated", async () => {
      const res = await api("/api/scan/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: "https://example.com/image.jpg",
        }),
      });
      await expectStatus(res, 401);
    });

    test("POST /api/scan/analyze - should return 400 when image_url is missing", async () => {
      const res = await authenticatedApi("/api/scan/analyze", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await expectStatus(res, 400);
    });

    test("GET /api/scan/analyses - should return list of analyses", async () => {
      const res = await authenticatedApi("/api/scan/analyses", authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data).toHaveProperty("analyses");
      expect(Array.isArray(data.analyses)).toBe(true);
    });

    test("GET /api/scan/analyses - should return 401 when not authenticated", async () => {
      const res = await api("/api/scan/analyses");
      await expectStatus(res, 401);
    });

    test("PATCH /api/scan/analyses/{id} - should update actual portion when analysis exists", async () => {
      if (!analysisId) {
        // Skip if we couldn't create an analysis with 200 status
        return;
      }
      const res = await authenticatedApi(`/api/scan/analyses/${analysisId}`, authToken, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actual_portion_pct: 50,
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data).toHaveProperty("id");
      expect(data).toHaveProperty("actual_portion_pct");
    });

    test("PATCH /api/scan/analyses/{id} - should return 400 for portion percentage > 100", async () => {
      if (!analysisId) {
        return;
      }
      const res = await authenticatedApi(`/api/scan/analyses/${analysisId}`, authToken, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actual_portion_pct: 150,
        }),
      });
      await expectStatus(res, 400);
    });

    test("PATCH /api/scan/analyses/{id} - should return 400 for portion percentage < 0", async () => {
      if (!analysisId) {
        return;
      }
      const res = await authenticatedApi(`/api/scan/analyses/${analysisId}`, authToken, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actual_portion_pct: -10,
        }),
      });
      await expectStatus(res, 400);
    });

    test("PATCH /api/scan/analyses/{id} - should return 400 when actual_portion_pct is missing", async () => {
      if (!analysisId) {
        return;
      }
      const res = await authenticatedApi(`/api/scan/analyses/${analysisId}`, authToken, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await expectStatus(res, 400);
    });

    test("PATCH /api/scan/analyses/{id} - should return 404 for non-existent analysis", async () => {
      const res = await authenticatedApi(`/api/scan/analyses/nonexistent-id`, authToken, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actual_portion_pct: 50,
        }),
      });
      await expectStatus(res, 404);
    });

    test("PATCH /api/scan/analyses/{id} - should return 401 when not authenticated", async () => {
      const res = await api(`/api/scan/analyses/some-id`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actual_portion_pct: 50,
        }),
      });
      await expectStatus(res, 401);
    });
  });
});
