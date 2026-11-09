import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(testDir, "..");

test("index management can be imported without a configured database URI", () => {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", 'await import("./scripts/indexes.js")'],
    {
      cwd: backendDir,
      env: {
        ...process.env,
        MONGO_URI: "",
      },
      encoding: "utf8",
    },
  );

  assert.equal(
    result.status,
    0,
    `Expected a side-effect-free import.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
});

test("managed index planning includes the user suggestion quota indexes", () => {
  const source = fs.readFileSync(
    path.join(backendDir, "scripts", "indexes.js"),
    "utf8",
  );

  assert.match(source, /models\/UserSuggestion\.js/);
  assert.match(source, /\["UserSuggestion", UserSuggestion\]/);
});

test('index planning discovers submission queue indexes without mutating data', async t => {
  const { default: dotenv } = await import('dotenv');
  t.mock.method(dotenv, 'config', () => ({ parsed: {} }));
  const { runIndexManagement } = await import('../scripts/indexes.js');
  const { default: mongoose } = await import('mongoose');
  for (const model of Object.values(mongoose.models)) {
    t.mock.method(model, 'diffIndexes', async () => ({ toCreate: model.schema.indexes().map(([key]) => key), toDrop: [] }));
    t.mock.method(model.collection, 'indexes', async () => []);
    t.mock.method(model, 'createIndexes', async () => assert.fail('Planning must not create indexes.'));
  }
  const result = await runIndexManagement({ mode: 'plan', shouldConnect: false, shouldDisconnect: false,
    log: () => {}, errorLog: (...args) => assert.fail(args.join(' ')) });
  const plans = new Map(result.results.map(item => [item.name, item.diff.toCreate]));
  for (const [name, key] of [
    ['AutoApplyAttempt', { status: 1, leaseUntil: 1, createdAt: 1 }],
  ]) assert.ok(plans.get(name)?.some(index => JSON.stringify(index) === JSON.stringify(key)), `${name} index missing from managed plan`);
});
