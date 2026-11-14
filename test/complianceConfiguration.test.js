import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import connectDB from '../db/db.js';
import { auditPage } from '../src/seo/pageAudit.js';

function databaseFixture(t, uri, nodeEnv = 'production') {
  const previous = { MONGO_URI: process.env.MONGO_URI, NODE_ENV: process.env.NODE_ENV };
  process.env.MONGO_URI = uri;
  process.env.NODE_ENV = nodeEnv;
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const result = { connection: { host: 'fixture.invalid' } };
  const connection = t.mock.method(mongoose, 'connect', async () => result);
  return { result, connection };
}

const insecureUris = [
  ['missing authentication', 'mongodb://db.example.test/app?tls=true'],
  ['plaintext transport', 'mongodb://user:fixture-password@db.example.test/app'],
  ['disabled SRV TLS', 'mongodb+srv://user:fixture-password@db.example.test/app?tls=false'],
  ['disabled SSL alias', 'mongodb://user:fixture-password@db.example.test/app?ssl=false'],
  ['disabled certificate validation', 'mongodb://user:fixture-password@db.example.test/app?tls=true&tlsAllowInvalidCertificates=true'],
  ['disabled hostname validation', 'mongodb://user:fixture-password@db.example.test/app?tls=true&tlsAllowInvalidHostnames=true'],
  ['insecure TLS mode', 'mongodb://user:fixture-password@db.example.test/app?tls=true&tlsInsecure=true'],
  ['authSource without credentials', 'mongodb://db.example.test/app?tls=true&authSource=admin'],
  ['malformed URI', 'mongodb://user:fixture-password@/?tls=true'],
];

for (const [name, uri] of insecureUris) {
  test(`production MongoDB rejects ${name} before opening a connection`, async t => {
    const { connection } = databaseFixture(t, uri);
    await assert.rejects(connectDB(), error => error.code === 'INSECURE_MONGO_CONFIGURATION'
      && !error.message.includes('fixture-password') && !error.message.includes(uri));
    assert.equal(connection.mock.callCount(), 0);
  });
}

for (const [name, uri] of [
  ['standard authenticated TLS', 'mongodb://user:fixture-password@db.example.test/app?tls=true'],
  ['SRV TLS defaults', 'mongodb+srv://user:fixture-password@db.example.test/app'],
  ['multiple seeds and SSL alias', 'mongodb://user:fixture-password@one.example.test:27017,two.example.test:27017/app?ssl=true'],
  ['encoded authentication', 'mongodb://user%40example:fixture%3Apassword@db.example.test/app?tls=true'],
  ['certificate authentication', 'mongodb://db.example.test/app?tls=true&authMechanism=MONGODB-X509'],
  ['explicit certificate and hostname validation', 'mongodb://user:fixture-password@db.example.test/app?tls=true&tlsAllowInvalidCertificates=false&tlsAllowInvalidHostnames=false'],
]) {
  test(`production MongoDB preserves ${name}`, async t => {
    const { result, connection } = databaseFixture(t, uri);
    assert.equal(await connectDB(), result);
    assert.equal(connection.mock.callCount(), 1);
  });
}

test('development retains local fixture database connections', async t => {
  const { result } = databaseFixture(t, 'mongodb://127.0.0.1:27017/fixture', 'test');
  assert.equal(await connectDB(), result);
});

test('production MongoDB rejects a global TLS validation bypass', async t => {
  const { connection } = databaseFixture(t, 'mongodb://user:fixture-password@db.example.test/app?tls=true');
  const previous = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  t.after(() => {
    if (previous === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = previous;
  });
  await assert.rejects(connectDB(), error => error.code === 'INSECURE_MONGO_CONFIGURATION');
  assert.equal(connection.mock.callCount(), 0);
});

const aiEnvironment = { ANTHROPIC_API_KEY: 'fixture-api-key', ANTHROPIC_MODEL: 'fixture-model' };
const page = { url: 'https://example.test/jobs', title: 'Fixture jobs' };
const providerResponse = () => new Response(JSON.stringify({ stop_reason: 'tool_use',
  content: [{ type: 'tool_use', name: 'seo_recommendations', input: { summary: 'Fixture audit.', recommendations: [] } }] }));

for (const reviewed of [undefined, '', 'false', '1']) {
  test(`optional Claude processing blocks unreviewed data use (${String(reviewed)})`, async () => {
    let sent = false;
    await assert.rejects(auditPage(page, {
      env: { ...aiEnvironment, ANTHROPIC_DATA_USE_REVIEWED: reviewed },
      fetchImpl: async () => { sent = true; return providerResponse(); },
    }), error => error.status === 503 && error.code === 'provider_data_use_unreviewed');
    assert.equal(sent, false);
  });
}

test('reviewed optional Claude processing retains structured audit output', async () => {
  const report = await auditPage(page, {
    env: { ...aiEnvironment, ANTHROPIC_DATA_USE_REVIEWED: 'true' }, fetchImpl: async () => providerResponse(),
  });
  assert.equal(report.summary, 'Fixture audit.');
  assert.equal(report.model, 'fixture-model');
});
