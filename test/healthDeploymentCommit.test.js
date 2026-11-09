import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import mongoose from 'mongoose'

Object.assign(process.env, {
  NODE_ENV: 'test', PAYMENT_PROVIDER: 'razorpay', JWT_SECRET: 'health-tests-only-secret-at-least-32-characters',
  CORS_ORIGIN: 'https://app.jobverify.test',
})
const { createApp } = await import('../src/app.js')

const inspect = async (value, expected) => {
  const old = process.env.RENDER_GIT_COMMIT
  if (value === undefined) delete process.env.RENDER_GIT_COMMIT
  else process.env.RENDER_GIT_COMMIT = value
  const server = createApp().listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/health`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    const body = await response.json()
    assert.equal(body.status, 'ok')
    assert.equal(Number.isSafeInteger(body.uptimeSeconds), true)
    assert.ok(body.uptimeSeconds >= 0)
    assert.equal(Number.isFinite(Date.parse(body.timestamp)), true)
    assert.equal(mongoose.connection.readyState, 0)
    assert.deepEqual(Object.keys(body).sort(), (expected ? ['deploymentCommit', 'status', 'timestamp', 'uptimeSeconds'] : ['status', 'timestamp', 'uptimeSeconds']).sort())
    if (expected) assert.equal(body.deploymentCommit, expected)
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    if (old === undefined) delete process.env.RENDER_GIT_COMMIT
    else process.env.RENDER_GIT_COMMIT = old
  }
}

test('health exposes only the exact valid Render commit and preserves existing health fields', async () => {
  for (const commit of ['1234567890abcdef1234567890abcdef12345678', 'ABCDEF1234567890ABCDEF1234567890ABCDEF12']) await inspect(commit, commit)
})
test('health without a Render commit preserves its existing public response without adding a field', async () => {
  await inspect(undefined)
})
test('health excludes malformed, padded, truncated and non-hex deployment metadata', async () => {
  for (const value of ['', 'a'.repeat(39), 'a'.repeat(41), 'g'.repeat(40), ' ' + 'a'.repeat(40),
    ...['\n', '\r', '\r\n', '\u2028', '\u2029'].map(suffix => 'a'.repeat(40) + suffix), 'secret deployment environment value']) await inspect(value)
})
