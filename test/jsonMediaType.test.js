import assert from "node:assert/strict";
import test from "node:test";
import { requireJsonMutation } from "../src/middleware/validateRequest.js";

for (const contentType of ["application/jsonp", "application/json-evil", "application/jsonsuffix; charset=utf-8"]) {
  test(`JSON mutation guard rejects unsupported media type ${contentType}`, () => {
    let status;
    let allowed = false;
    const req = {
      method: "POST",
      headers: { "content-length": "2", "content-type": contentType },
      is: () => false,
    };
    const res = { status(value) { status = value; return this; }, json() {} };
    requireJsonMutation(req, res, () => { allowed = true; });
    assert.equal(allowed, false);
    assert.equal(status, 415);
  });
}
