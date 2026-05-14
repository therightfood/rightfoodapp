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

  describe("Profile stats endpoints", () => {
    test("GET /api/profile/stats - should return user statistics when authenticated", async () => {
      const res = await authenticatedApi("/api/profile/stats", authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data).toHaveProperty("total_meals_scanned");
      expect(data).toHaveProperty("days_using_app");
      expect(data).toHaveProperty("current_streak");
    });

    test("GET /api/profile/stats - should return 401 when not authenticated", async () => {
      const res = await api("/api/profile/stats");
      await expectStatus(res, 401);
    });
  });

  describe("Reminder endpoints", () => {
    test("PUT /api/profile/reminders - should update reminders when authenticated", async () => {
      const res = await authenticatedApi("/api/profile/reminders", authToken, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reminder_enabled: true,
          reminder_times: ["09:00", "14:00", "18:00"],
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data).toHaveProperty("reminder_enabled");
      expect(data).toHaveProperty("reminder_times");
      expect(data.reminder_enabled).toBe(true);
    });

    test("PUT /api/profile/reminders - should accept fewer reminder times", async () => {
      const res = await authenticatedApi("/api/profile/reminders", authToken, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reminder_enabled: false,
          reminder_times: ["10:00"],
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.reminder_enabled).toBe(false);
    });

    test("PUT /api/profile/reminders - should return 400 when reminder_enabled is missing", async () => {
      const res = await authenticatedApi("/api/profile/reminders", authToken, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reminder_times: ["10:00"],
        }),
      });
      await expectStatus(res, 400);
    });

    test("PUT /api/profile/reminders - should return 400 when reminder_times is missing", async () => {
      const res = await authenticatedApi("/api/profile/reminders", authToken, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reminder_enabled: true,
        }),
      });
      await expectStatus(res, 400);
    });

    test("PUT /api/profile/reminders - should return 400 when reminder_times exceeds maxItems", async () => {
      const res = await authenticatedApi("/api/profile/reminders", authToken, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reminder_enabled: true,
          reminder_times: ["09:00", "12:00", "15:00", "18:00"],
        }),
      });
      await expectStatus(res, 400);
    });

    test("PUT /api/profile/reminders - should return 401 when not authenticated", async () => {
      const res = await api("/api/profile/reminders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reminder_enabled: true,
          reminder_times: ["10:00"],
        }),
      });
      await expectStatus(res, 401);
    });
  });

  describe("Account deletion endpoints", () => {
    test("DELETE /api/account - should delete account when authenticated", async () => {
      // Create a separate test user for deletion
      const { token: deletionToken } = await signUpTestUser();

      const res = await authenticatedApi("/api/account", deletionToken, {
        method: "DELETE",
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data).toHaveProperty("deleted");
      expect(data.deleted).toBe(true);
    });

    test("DELETE /api/account - should return 401 when not authenticated", async () => {
      const res = await api("/api/account", {
        method: "DELETE",
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

    test("POST /api/scan/upload - should handle large files (200 or 413)", async () => {
      const form = new FormData();
      // Create a file with substantial content (~5MB) to test size limits
      const largeContent = "x".repeat(5 * 1024 * 1024);
      form.append("file", createTestFile("large.jpg", largeContent, "image/jpeg"));

      const res = await authenticatedApi("/api/scan/upload", authToken, {
        method: "POST",
        body: form,
      });
      // Accept either 200 (within limit) or 413 (exceeds limit)
      await expectStatus(res, 200, 413);
      if (res.status === 200) {
        const data = await res.json();
        expect(data).toHaveProperty("image_url");
      }
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

  describe("Journey endpoints", () => {
    test("GET /api/journey - should return meal journey analytics when authenticated", async () => {
      const res = await authenticatedApi("/api/journey", authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data).toHaveProperty("summary");
      expect(data).toHaveProperty("meals");
      expect(Array.isArray(data.meals)).toBe(true);
      // Verify summary has expected fields
      expect(data.summary).toHaveProperty("today_calories");
      expect(data.summary).toHaveProperty("today_meal_count");
    });

    test("GET /api/journey - should return 401 when not authenticated", async () => {
      const res = await api("/api/journey");
      await expectStatus(res, 401);
    });
  });

  describe("Recipe endpoints", () => {
    test("POST /api/recipes/extract-ingredients - should extract ingredients from image", async () => {
      const form = new FormData();
      form.append("file", createTestFile("ingredients.jpg", "fake image data", "image/jpeg"));

      const res = await authenticatedApi("/api/recipes/extract-ingredients", authToken, {
        method: "POST",
        body: form,
      });
      await expectStatus(res, 200, 422);
      if (res.status === 200) {
        const data = await res.json();
        expect(data).toHaveProperty("ingredients");
        expect(Array.isArray(data.ingredients)).toBe(true);
      }
    });

    test("POST /api/recipes/extract-ingredients - should return 401 when not authenticated", async () => {
      const form = new FormData();
      form.append("file", createTestFile("ingredients.jpg", "fake image data", "image/jpeg"));

      const res = await api("/api/recipes/extract-ingredients", {
        method: "POST",
        body: form,
      });
      await expectStatus(res, 401);
    });

    test("POST /api/recipes/extract-ingredients - should return 400 when file is missing", async () => {
      const form = new FormData();

      const res = await authenticatedApi("/api/recipes/extract-ingredients", authToken, {
        method: "POST",
        body: form,
      });
      await expectStatus(res, 400);
    });

    test("POST /api/recipes/extract-ingredients - should handle large files (200 or 413)", async () => {
      const form = new FormData();
      const largeContent = "x".repeat(5 * 1024 * 1024);
      form.append("file", createTestFile("large.jpg", largeContent, "image/jpeg"));

      const res = await authenticatedApi("/api/recipes/extract-ingredients", authToken, {
        method: "POST",
        body: form,
      });
      await expectStatus(res, 200, 413, 422);
      if (res.status === 200) {
        const data = await res.json();
        expect(data).toHaveProperty("ingredients");
      }
    });

    test("POST /api/recipes/generate - should generate recipes from ingredients", async () => {
      const res = await authenticatedApi("/api/recipes/generate", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: "chicken, rice, broccoli",
        }),
      });
      await expectStatus(res, 200, 422);
      if (res.status === 200) {
        const data = await res.json();
        expect(data).toHaveProperty("session_id");
        expect(data).toHaveProperty("recipes");
        expect(Array.isArray(data.recipes)).toBe(true);
      }
    });

    test("POST /api/recipes/generate - should accept optional medication and dose", async () => {
      const res = await authenticatedApi("/api/recipes/generate", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: "salmon, asparagus, lemon",
          medication: "Ozempic",
          dose_mg: 1,
        }),
      });
      await expectStatus(res, 200, 422);
      if (res.status === 200) {
        const data = await res.json();
        expect(data).toHaveProperty("session_id");
        expect(data).toHaveProperty("recipes");
      }
    });

    test("POST /api/recipes/generate - should return 401 when not authenticated", async () => {
      const res = await api("/api/recipes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: "chicken, rice, broccoli",
        }),
      });
      await expectStatus(res, 401);
    });

    test("POST /api/recipes/generate - should return 400 when ingredients are missing", async () => {
      const res = await authenticatedApi("/api/recipes/generate", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await expectStatus(res, 400);
    });
  });

  describe("Menu endpoints", () => {
    test("POST /api/menus/analyze - should analyze menu image successfully (200 or 422)", async () => {
      const form = new FormData();
      form.append("file", createTestFile("menu.jpg", "fake menu image data", "image/jpeg"));

      const res = await authenticatedApi("/api/menus/analyze", authToken, {
        method: "POST",
        body: form,
      });
      await expectStatus(res, 200, 422);
      if (res.status === 200) {
        const data = await res.json();
        expect(data).toHaveProperty("session_id");
        expect(data).toHaveProperty("image_url");
        expect(data).toHaveProperty("extracted_items");
        expect(Array.isArray(data.extracted_items)).toBe(true);
        expect(data).toHaveProperty("recommendations");
        expect(Array.isArray(data.recommendations)).toBe(true);
      }
    });

    test("POST /api/menus/analyze - should return 401 when not authenticated", async () => {
      const form = new FormData();
      form.append("file", createTestFile("menu.jpg", "fake menu image data", "image/jpeg"));

      const res = await api("/api/menus/analyze", {
        method: "POST",
        body: form,
      });
      await expectStatus(res, 401);
    });

    test("POST /api/menus/analyze - should return 400 when file is missing", async () => {
      const form = new FormData();

      const res = await authenticatedApi("/api/menus/analyze", authToken, {
        method: "POST",
        body: form,
      });
      await expectStatus(res, 400);
    });

    test("POST /api/menus/analyze - should handle large files (200, 413, or 422)", async () => {
      const form = new FormData();
      const largeContent = "x".repeat(5 * 1024 * 1024);
      form.append("file", createTestFile("large_menu.jpg", largeContent, "image/jpeg"));

      const res = await authenticatedApi("/api/menus/analyze", authToken, {
        method: "POST",
        body: form,
      });
      await expectStatus(res, 200, 413, 422);
      if (res.status === 200) {
        const data = await res.json();
        expect(data).toHaveProperty("session_id");
        expect(data).toHaveProperty("extracted_items");
      }
    });
  });
});
