import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { validateCurrentPublisher } from './nativeCurrentWorkable.js'
import { currentPublisherSHA } from './currentPublisher20261118.js'
import { run } from './script.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261128/native-capture.json.gz', import.meta.url))))
const pages = fixture.responses.filter(row => row.requestedUrl === 'https://leena.ai/careers')
const client = fixture.responses.find(row => row.requestedUrl.endsWith('/careers-15090a0f10f8bc12.js'))
const fingerprint = 'd3f3c065e7b1df4b3134a29c96894b0b57cdf9937acabcde325f0e65769d4c80'
const hash = value => createHash('sha256').update(value).digest('hex')

test('current genuine Leena documents retain the exact unchanged career factory with and without the reviewed beacon', () => {
  assert.equal(pages.length, 2)
  assert.deepEqual(pages.map(row => Buffer.byteLength(row.body)), [191708, 191347])
  for (const row of fixture.responses) {
    assert.equal(row.status, 200)
    assert.equal(hash(row.body), row.sha256)
  }
  for (const page of pages) {
    const proof = validateCurrentPublisher(page.body, client.body)
    assert.equal(proof.corporateProfileSHA256, fingerprint)
    assert.equal(proof.bundleSHA256, 'c41f4d7591956790cb2731b7f0b54d8ca1eb893667ca66afd0cfe6e48f339596')
    assert.equal(proof.browserEquivalenceClaimed, false)
  }
})

test('default current acquisition can reach the declared public feed only after the genuine current publisher and client', async () => {
  const calls = [], marker = new Error('Feed transport sentinel: no vacancy facts provided')
  await assert.rejects(run({ fetchImpl: async (input, init) => {
    const url = String(input)
    calls.push(url)
    assert.equal(init.method, 'GET')
    assert.equal(init.credentials, 'omit')
    assert.equal(init.redirect, 'manual')
    const packet = fixture.responses.find(row => row.requestedUrl === url)
    if (!packet) {
      assert.equal(url, 'https://bots.leena.ai/api/website/careers/jobs')
      throw marker
    }
    return Object.defineProperty(new Response(packet.body, { status: 200, headers: packet.headers }), 'url', { value: packet.url })
  } }), error => error === marker)
  assert.deepEqual(calls, ['https://leena.ai/careers', client.requestedUrl, 'https://bots.leena.ai/api/website/careers/jobs'])
})

for (const [label, change] of [
  ['a same-size unknown app', html => html.replace('_app-c9185796b706d9dd', '_app-c9185796b706d9dc')],
  ['a changed navigation destination', html => html.replace('enterprise-agentic-ai-trust-security', 'enterprise-agentic-ai-trust-securitx')],
  ['a changed fixed stylesheet', html => html.replace('#0F72EE', '#0F72EF')],
  ['a changed native career declaration', html => html.replace('careers-15090a0f10f8bc12', 'careers-15090a0f10f8bc13')],
  ['a changed build identity', html => html.replace('7ag7xn49dIapM004JkV23', '7ag7xn49dIapM004JkV24')],
  ['an added executable program', html => html + '<script>window.unreviewed=true</script>'],
  ['an uncorrelated opaque delivery ID', html => html.replace(/main.js\?ray=[a-f0-9]{16}/, 'main.js?ray=0000000000000000')],
]) {
  test('the exact current Leena profile rejects ' + label, () => {
    const changed = change(pages[1].body)
    assert.notEqual(changed, pages[1].body)
    assert.throws(() => currentPublisherSHA(changed), error => error.failureKind === 'parser_or_contract_error')
  })
}

test('an unreviewed current career factory cannot inherit the accepted document profile', () => {
  assert.throws(() => validateCurrentPublisher(pages[1].body, client.body + ';window.newCriteria=true;'), error => error.failureKind === 'parser_or_contract_error')
})

test('opaque delivery IDs can vary together without changing the exact business and program document frame', () => {
  const original = pages[1].body
  const match = /window\.__CF\$cv\$params=\{r:'([a-f0-9]{16})',t:'([A-Za-z0-9+/]{14}==)'\}/.exec(original)
  assert.ok(match)
  const changed = original.replaceAll(match[1], '0123456789abcdef').replace(match[2], Buffer.from('1234567890').toString('base64'))
  assert.notEqual(changed, original)
  assert.equal(currentPublisherSHA(changed), fingerprint)
})
