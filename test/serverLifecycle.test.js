import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";
import { createPeriodicTask, createShutdown } from "../src/runtime/lifecycle.js";

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("periodic work never overlaps, recovers from rejection, and stops scheduling", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const first = deferred();
  let calls = 0;
  const errors = [];
  const stop = createPeriodicTask(async () => {
    calls += 1;
    if (calls === 1) await first.promise;
    if (calls === 2) throw new Error("temporary failure");
  }, { intervalMs: 10, runImmediately: true, onError: (error) => errors.push(error.message) });
  await flush();
  t.mock.timers.tick(100);
  assert.equal(calls, 1);
  first.resolve();
  await flush();
  t.mock.timers.tick(10);
  await flush();
  assert.equal(calls, 2);
  assert.deepEqual(errors, ["temporary failure"]);
  t.mock.timers.tick(10);
  await flush();
  assert.equal(calls, 3);
  await stop();
  t.mock.timers.tick(100);
  await flush();
  assert.equal(calls, 3);
});

test("shutdown drains an in-flight HTTP response and work before disconnecting, once", async () => {
  const requestStarted = deferred();
  const work = deferred();
  let response;
  const server = http.createServer((_req, res) => { response = res; requestStarted.resolve(); });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const fetchResult = fetch(`http://127.0.0.1:${server.address().port}`).then((res) => res.text());
  await requestStarted.promise;
  let disconnects = 0;
  const shutdown = createShutdown({
    server, stopTasks: [() => work.promise],
    disconnect: async () => { disconnects += 1; },
    timeoutMs: 1000,
  });
  const shutdownResult = shutdown();
  assert.equal(shutdown(), shutdownResult);
  assert.equal(disconnects, 0);
  response.end("completed");
  assert.equal(await fetchResult, "completed");
  await flush();
  assert.equal(disconnects, 0);
  work.resolve();
  await shutdownResult;
  assert.equal(disconnects, 1);
  assert.equal(server.listening, false);
});

test("shutdown enforces a deadline when background work cannot finish", async () => {
  const server = http.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const shutdown = createShutdown({
    server, stopTasks: [() => new Promise(() => {})],
    disconnect: async () => {}, timeoutMs: 20,
  });
  await assert.rejects(shutdown(), /Shutdown exceeded/);
  assert.equal(server.listening, false);
});
