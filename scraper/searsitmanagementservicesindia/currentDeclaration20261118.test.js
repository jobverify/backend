import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261118.json.gz', import.meta.url))))
const replay = change => {
  const reads = []
  return { reads, options: { requestIntervalMs: 0, fetchImpl: async (url, init) => {
    const packet = structuredClone(fixture.responses[reads.length])
    assert.ok(packet, 'only the publisher and declared native endpoint are read')
    assert.equal(url, packet.requestedUrl)
    assert.equal(init.method, 'GET')
    assert.equal(init.redirect, 'manual')
    reads.push(url)
    change?.(packet)
    return Object.defineProperty(new Response(packet.text, { status: packet.status, headers: packet.headers }), 'url', { value: packet.finalUrl })
  } } }
}

test('current Sears tracking deployment reaches its declared missing native feed without certifying an empty inventory', async () => {
  const io = replay()
  await assert.rejects(run(io.options), error => {
    assert.equal(error.failureKind, 'source_inventory_unavailable')
    assert.equal(error.httpStatus, 404)
    assert.equal(error.nativeCollectionEvidence.lifecycleCleanupAllowed, false)
    assert.equal(error.nativeCollectionEvidence.verifiedEmpty, false)
    assert.equal(error.nativeCollectionEvidence.companyIndiaTotal, null)
    assert.ok(error.nativeCollectionEvidence.nativeOpeningModel.nativeClient.fullAST)
    return true
  })
  assert.equal(io.reads.length, 3)
})

test('Sears accepts no unreviewed tracking program or changed job endpoint', async () => {
  for (const change of [
    text => text.replace('15386a882b17', 'unreviewed'),
    text => text.replace("fetch('/api/careers-openings')", "fetch('/api/other-company')"),
  ]) {
    const io = replay(packet => {
      if (packet.requestedUrl.endsWith('/careers/')) {
        const changed = change(packet.text)
        assert.notEqual(changed, packet.text)
        packet.text = changed
      }
    })
    await assert.rejects(run(io.options), error => error.failureKind === 'parser_or_contract_error')
    assert.equal(io.reads.length, 2)
  }
})
