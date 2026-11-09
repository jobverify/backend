import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = fs.readFileSync(
  path.join(import.meta.dirname, "..", "src", "routes", "authRoutes.js"),
  "utf8",
);

test("login limiter uses a 5 minute cooldown window and message", () => {
  assert.match(source, /const loginLimiter = createRateLimiter\(\{\s*windowMs: 5 \* 60 \* 1000,/s);
  assert.match(source, /Too many sign-in attempts, please try again after 5 minutes/);
});
