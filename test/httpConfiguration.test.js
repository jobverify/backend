import assert from "node:assert/strict";
import test from "node:test";
import { parseTrustProxy, parsePort } from "../src/config/http.js";

test("trust proxy preserves CIDR and address lists instead of treating their prefix as hop counts", () => {
  assert.equal(parseTrustProxy("10.0.0.0/8"), "10.0.0.0/8");
  assert.equal(parseTrustProxy("127.0.0.1, ::1"), "127.0.0.1, ::1");
  assert.equal(parseTrustProxy("loopback"), "loopback");
  assert.equal(parseTrustProxy("2"), 2);
  assert.equal(parseTrustProxy("true"), 1);
  assert.equal(parseTrustProxy("off"), false);
});
test("ports must be complete TCP port numbers instead of named pipes or partial integers", () => {
  assert.equal(parsePort("5000"), 5000);
  for (const value of ["5000x", "-1", "65536", "", "0", "1.5"]) {
    assert.throws(() => parsePort(value), /PORT/);
  }
});
