import test from 'node:test'
import assert from 'node:assert/strict'
import * as captureRequest from '../scripts/publicReadRequest20261114.mjs'
import { serializePublicReadRequest, shouldOmitCredentialBody } from '../scripts/publicReadRequest20261114.mjs'

test('multipart public queries preserve boundary, Unicode fields and binary bytes', async () => {
  const form = new FormData()
  form.set('company', 'Recruiting \u7cfb\u7edf')
  form.set('packet', new Blob([new Uint8Array([0, 128, 255])]), 'proof.bin')
  const packet = await serializePublicReadRequest('https://example.com/jobs/search', { method: 'POST', body: form })
  assert.match(packet.headers['content-type'], /^multipart\/form-data; boundary=/)
  const response = new Response(Buffer.from(packet.bodyBase64, 'base64'), { headers: packet.headers })
  const decoded = await response.formData()
  assert.equal(decoded.get('company'), 'Recruiting \u7cfb\u7edf')
  assert.deepEqual(Buffer.from(await decoded.get('packet').arrayBuffer()), Buffer.from([0, 128, 255]))
})

test('Request input preserves native method, headers and exact JSON bytes', async () => {
  const body = '{"query":"India \u7cfb\u7edf"}'
  const request = new Request('https://example.com/jobs/search', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Tenant': 'public' }, body,
  })
  const packet = await serializePublicReadRequest(request)
  assert.equal(packet.method, 'POST')
  assert.equal(packet.headers['x-tenant'], 'public')
  assert.equal(Buffer.from(packet.bodyBase64, 'base64').toString('utf8'), body)
  assert.equal(packet.headers['accept-encoding'], 'identity')
})

test('bodyless requests retain null body and caller user agent', async () => {
  const packet = await serializePublicReadRequest('https://example.com/jobs', { headers: { 'User-Agent': 'source-native' } })
  assert.equal(packet.bodyBase64, null)
  assert.equal(packet.method, 'GET')
  assert.equal(packet.headers['user-agent'], 'source-native')
})

test('issued credential responses are omitted without concealing ordinary role bodies', () => {
  for (const url of ['https://example.com/public/guest-token', 'https://example.com/token/noauth', 'https://example.com/csrf-token']) {
    assert.equal(shouldOmitCredentialBody(url, Buffer.from('{}')), true)
  }
  assert.equal(shouldOmitCredentialBody('https://example.com/public/identity', Buffer.from('{"data":{"access_token":"opaque-issued-value-0123456789"}}')), true)
  assert.equal(shouldOmitCredentialBody('https://example.com/public/identity', Buffer.from('{"data":[{"accessToken":"opaque-issued-value-0123456789"}]}')), true)
  assert.equal(shouldOmitCredentialBody('https://example.com/jobs/token-engineer', Buffer.from('{"title":"Token engineer","description":"native full criteria"}')), false)
})

test('receipt URLs, redirects and diagnostic text redact credential query values', () => {
  const secret = 'synthetic-review-token-0123456789'
  const url = `https://example.com/jobs?access_token=${secret}&country=India`
  const cleaned = captureRequest.redactCaptureUrl(url)
  assert.equal(new URL(cleaned).searchParams.get('access_token'), '[omitted]')
  assert.equal(new URL(cleaned).searchParams.get('country'), 'India')
  assert.equal(captureRequest.redactCaptureUrl(`/jobs?token=${secret}`), '/jobs?token=%5Bomitted%5D')
  assert.equal(captureRequest.redactCaptureText(`HTTP403 at ${url}`).includes(secret), false)
  assert.equal(captureRequest.redactCaptureUrl('https://example.com/jobs?jobId=123'), 'https://example.com/jobs?jobId=123')
})

test('the effective Request cancellation signal aborts before transport preparation', async () => {
  const controller = new AbortController()
  const reason = new Error('original caller cancellation')
  controller.abort(reason)
  const request = new Request('https://example.com/jobs', { signal: controller.signal })
  await assert.rejects(serializePublicReadRequest(request), error => error === reason)
})

test('the effective Request cancellation signal remains observable after serialization', async () => {
  const controller = new AbortController()
  const packet = await serializePublicReadRequest(new Request('https://example.com/jobs', { signal: controller.signal }))
  const reason = new Error('later caller cancellation')
  controller.abort(reason)
  assert.equal(packet.signal.aborted, true)
  assert.equal(packet.signal.reason, reason)
  assert.equal(Object.keys(packet).includes('signal'), false)
})

test('credential response detection has no nesting-depth retention gap', () => {
  const body = Buffer.from(JSON.stringify({ a: { b: { c: { d: { access_token: 'synthetic-review-token-0123456789' } } } } }))
  assert.equal(shouldOmitCredentialBody('https://example.com/public/identity', body), true)
  assert.equal(shouldOmitCredentialBody('https://example.com/public/identity', Buffer.from('{"id_token":"synthetic-review-token-0123456789"}')), true)
})
