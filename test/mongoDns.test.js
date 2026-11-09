import assert from "node:assert/strict";
import test from "node:test";

import { configureMongoDns } from "../src/utils/mongoDns.js";

test("configureMongoDns preserves the system resolver when no override is configured", () => {
  const configuredServers = [];

  configureMongoDns({
    setServers: (servers) => configuredServers.push(servers),
  });

  assert.deepEqual(configuredServers, []);
});

test("configureMongoDns applies an explicit resolver override", () => {
  const configuredServers = [];

  configureMongoDns(
    { setServers: (servers) => configuredServers.push(servers) },
    { MONGO_DNS_SERVERS: "1.1.1.1, 8.8.8.8" },
  );

  assert.deepEqual(configuredServers, [["1.1.1.1", "8.8.8.8"]]);
});
