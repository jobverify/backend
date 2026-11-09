import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = new URL("../scripts/purgeGreenkoHubJobs.js", import.meta.url).href;

test("purgeGreenkoHubJobs deletes only the retired Greenko Hub company records after confirmation", () => {
  const harness = `
    import { registerHooks } from "node:module";
    process.argv[2] = "--confirm";
    registerHooks({
      resolve(specifier, context, next) {
        if (specifier === "dotenv") return { url: "fixture:dotenv", shortCircuit: true };
        if (specifier === "mongoose") return { url: "fixture:mongoose", shortCircuit: true };
        if (specifier.endsWith("/db/db.js")) return { url: "fixture:database", shortCircuit: true };
        if (specifier.endsWith("/models/Job.js")) return { url: "fixture:job", shortCircuit: true };
        return next(specifier, context);
      },
      load(url, context, next) {
        const sources = {
          "fixture:dotenv": "export default {config(){}};",
          "fixture:mongoose": "export default {async disconnect(){console.log('disconnected')}};",
          "fixture:database": "export default async function() { console.log('connected') };",
          "fixture:job": "export default {async countDocuments(query){console.log(JSON.stringify(query)); return 3}, async deleteMany(query){console.log(JSON.stringify(query)); return {deletedCount: 3}}};",
        };
        if (url in sources) return { format: "module", source: sources[url], shortCircuit: true };
        return next(url, context);
      },
    });
    await import(${JSON.stringify(script)});
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", harness], {
    encoding: "utf8", windowsHide: true, timeout: 15_000,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Matched 3 Greenko Hub job record\(s\)/);
  assert.match(result.stdout, /Deleted 3 Greenko Hub job record\(s\)/);
  assert.match(result.stdout, /\"company\":\"Greenko Hub\"/);
  assert.match(result.stdout, /\"source\":\"greenkohub\"/);
  assert.match(result.stdout, /disconnected/);
});
