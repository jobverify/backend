import assert from "node:assert/strict";
import test from "node:test";

test("job routes expose live hiring companies before the dynamic job id route", async () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = originalJwtSecret || "x".repeat(32);

  try {
    const { default: router } = await import("../src/routes/jobRoutes.js");
    const liveCompaniesLayer = router.stack.find(
      (entry) => entry.route?.path === "/live-companies" && entry.route.methods.get,
    );
    const dynamicJobLayer = router.stack.find(
      (entry) => entry.route?.path === "/:id" && entry.route.methods.get,
    );

    assert.ok(liveCompaniesLayer);
    assert.equal(liveCompaniesLayer.route.stack.at(-1).name, "getLiveHiringCompanies");
    assert.ok(router.stack.indexOf(liveCompaniesLayer) < router.stack.indexOf(dynamicJobLayer));
  } finally {
    process.env.JWT_SECRET = originalJwtSecret;
  }
});
