import assert from "node:assert/strict";
import test from "node:test";
import { OAuth2Client } from "google-auth-library";

test("Google identity preserves only the signed hosted-domain claim", async t => {
  const { verifyGoogleCredential } = await import("../src/utils/googleAuth.js");
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_ID = "fixture-google-client";
  t.after(() => {
    if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = originalClientId;
  });
  for (const hd of ["college.edu", undefined]) {
    const verify = t.mock.method(OAuth2Client.prototype, "verifyIdToken", async options => {
      assert.equal(options.audience, "fixture-google-client");
      assert.equal(options.idToken, "fixture-credential");
      return { getPayload: () => ({ email: "owner@college.edu", email_verified: true, sub: "fixture-sub", hd }) };
    });
    assert.equal((await verifyGoogleCredential("fixture-credential")).hostedDomain, hd ?? "");
    verify.mock.restore();
  }
});

test("verifyGoogleCredential rejects when GOOGLE_CLIENT_ID is missing", async () => {
  const moduleOrError = await import("../src/utils/googleAuth.js").catch((error) => ({ error }));

  assert.equal(
    "error" in moduleOrError,
    false,
    moduleOrError.error?.message ?? "googleAuth.js should load for this test",
  );

  const { verifyGoogleCredential } = moduleOrError;

  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_ID;

  try {
    await assert.rejects(
      () => verifyGoogleCredential("header.payload.signature"),
      /GOOGLE_CLIENT_ID/,
    );
  } finally {
    if (originalClientId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = originalClientId;
    }
  }
});
