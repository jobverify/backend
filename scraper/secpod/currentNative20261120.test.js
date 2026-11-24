import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { run } from './script.js'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-keka-20261120.json.gz', import.meta.url))))
const packets = new Map(fixture.responses.map(packet => [packet.requestedURL, packet]))
const originalBody = packet => {
  const bytes = Buffer.from(packet.bodyBase64, 'base64')
  assert.equal(bytes.length, packet.bodyBytes)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), packet.bodySHA256)
  return bytes.toString('utf8')
}
const inventoryURL = 'https://secpod.keka.com/careers/api/embedjobs/default/active/8010166a-b48d-4997-9d93-64a354522150'
const originals = JSON.parse(originalBody(packets.get(inventoryURL)))
const replay = (replace = (_url, body) => body) => {
  const calls = []
  return { calls, options: { now: () => '2026-11-20T18:30:00.000Z', requestIntervalMs: 0,
    fetchText: async url => {
      calls.push(url)
      const packet = packets.get(url)
      assert.ok(packet, 'Unretained response may not be fabricated: ' + url)
      return replace(url, originalBody(packet))
    },
  } }
}

test('current SecPod careers client acquires its seven declared Keka India roles with native dates and descriptions', async () => {
  const { options, calls } = replay()
  const jobs = await run(options)
  assert.equal(jobs.length, 7)
  assert.deepEqual(jobs.map(job => job.jobId), ['171025', '170917', '170715', '170613', '169268', '164138', '161615'])
  assert.equal(jobs[0].title, 'Senior Security Research Engineer')
  assert.equal(jobs[0].postingDate, '2026-11-20T06:32:38.733Z')
  assert.equal(jobs.at(-1).postingDate, '2026-09-17T05:51:05.943Z')
  for (const [index, job] of jobs.entries()) {
    assert.equal(job.country, 'India')
    assert.equal(job.sourceDescription, originals[index].description)
    assert.equal(job.jobDescription, originals[index].description)
    assert.deepEqual(job.nativeSourceRecord, originals[index])
    assert.equal(job.sourceUrl, 'https://secpod.keka.com/careers/jobdetails/' + originals[index].id)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
  }
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  assert.ok(calls.includes(inventoryURL))
})

test('SecPod current acquisition also uses complete bounded native HTTP responses', async () => {
  const jobs = await run({ requestIntervalMs: 0, fetchImpl: async url => {
    const packet = packets.get(url)
    assert.ok(packet, 'Unretained response may not be fabricated: ' + url)
    const response = new Response(originalBody(packet), { status: packet.status, headers: { 'content-type': packet.contentType } })
    Object.defineProperty(response, 'url', { value: packet.finalURL })
    return response
  } })
  assert.equal(jobs.length, 7)
  assert.equal(jobs.nativeCollectionEvidence.retainedResponses.length, 5)
  assert.ok(jobs.nativeCollectionEvidence.retainedResponses.every(receipt => receipt.status === 200 && receipt.bytes > 0
    && receipt.finalURL === receipt.requestedURL))
})

test('the observed Keka renderer MIME exception cannot certify a corporate HTML response', async () => {
  let reads = 0
  await assert.rejects(run({ fetchImpl: async url => {
    reads++
    const response = new Response(originalBody(packets.get(url)), { status: 200, headers: { 'content-type': 'text/js' } })
    Object.defineProperty(response, 'url', { value: url })
    return response
  } }), /native response content type changed/)
  assert.equal(reads, 1)
})

test('a commented careers client cannot delegate SecPod native acquisition', async () => {
  const { options, calls } = replay((url, body) => url === 'https://www.secpod.com/careers'
    ? body.replace(/<script\b[^>]*src="([^\"]*1rlegxh7vrma8\.js)"[^>]*><\/script>/,
      '<!--$&-->') : body)
  await assert.rejects(run(options), /client is not actively declared/)
  assert.equal(calls.some(url => url.startsWith('https://secpod.keka.com/')), false)
})

test('a different native account cannot borrow the SecPod corporate declaration', async () => {
  const { options } = replay((url, body) => url.endsWith('/careerportalinfo')
    ? JSON.stringify({ ...JSON.parse(body), name: 'Another Employer' }) : body)
  await assert.rejects(run(options), /native account publisher changed/)
})

test('an unreviewed native role employer cannot be silently relabelled as SecPod', async () => {
  const { options } = replay((url, body) => {
    if (url !== inventoryURL) return body
    const rows = JSON.parse(body)
    rows[0].hiringOrganization = { name: 'Another Employer' }
    return JSON.stringify(rows)
  })
  await assert.rejects(run(options), /native role employer declaration/)
})

for (const [field, value] of [
  ['isActive', false], ['isPublished', false], ['isDeleted', true], ['closed', true],
  ['isInternal', true], ['isPublic', false], ['publicationStatus', 'closed'],
]) test('an explicit native publication declaration requires review: ' + field, async () => {
  const { options } = replay((url, body) => {
    if (url !== inventoryURL) return body
    const rows = JSON.parse(body)
    rows[0][field] = value
    return JSON.stringify(rows)
  })
  await assert.rejects(run(options), error => error?.code === 'SECPOD_NATIVE_CONTRACT'
    && /native role publication declaration/.test(error.message)
    && error.sourceScopeComplete === false && error.lifecycleCleanupAllowed === false)
})

test('the registered SecPod provider uses the repaired acquisition and retains incomplete evidence', async () => {
  const { options } = replay()
  const provider = getScraperCatalog().find(provider => provider.source === 'secpod')
  const jobs = await createCatalogScraper(provider).run(options)
  assert.equal(jobs.length, 7)
  assert.equal(jobs[0].sourceDescription, originals[0].description)
  assert.equal(jobs[0].postingDate, '2026-11-20T06:32:38.733Z')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('missing native country remains a held role even when the description mentions Bangalore', async () => {
  const { options } = replay((url, body) => {
    if (url !== inventoryURL) return body
    const rows = JSON.parse(body)
    rows[0].jobLocations = [{ city: 'Bangalore', state: 'KA' }]
    return JSON.stringify(rows)
  })
  const jobs = await run(options)
  assert.equal(jobs.length, 6)
  assert.equal(jobs.some(job => job.jobId === '171025'), false)
  assert.deepEqual(jobs.nativeCollectionEvidence.holds, [{ id: 171025, reason: 'native-work-country-unqualified' }])
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('contradictory explicit native country fields stop the source instead of becoming India', async () => {
  const { options } = replay((url, body) => {
    if (url !== inventoryURL) return body
    const rows = JSON.parse(body)
    rows[0].jobLocations[0].countryCode = 'US'
    return JSON.stringify(rows)
  })
  await assert.rejects(run(options), /contradictory native work countries/)
})

test('duplicate native role identities stop the source instead of hiding an inventory defect', async () => {
  const { options } = replay((url, body) => url === inventoryURL ? JSON.stringify([originals[0], originals[0]]) : body)
  await assert.rejects(run(options), /invalid or duplicate full native role/)
})

test('an empty active feed remains incomplete coverage with lifecycle cleanup held', async () => {
  const { options } = replay((url, body) => url === inventoryURL ? '[]' : body)
  const jobs = await run(options)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('a native publisher denial propagates before any empty result can be returned', async () => {
  await assert.rejects(run({ requestIntervalMs: 0, fetchImpl: async url => {
    const packet = packets.get(url)
    assert.ok(packet)
    const response = new Response(url === inventoryURL ? 'Forbidden' : originalBody(packet), {
      status: url === inventoryURL ? 403 : 200, headers: { 'content-type': packet.contentType },
    })
    Object.defineProperty(response, 'url', { value: packet.finalURL })
    return response
  } }), /403|denied|challenge/i)
})

test('the caller request cap stops before requesting the feed', async () => {
  const { options, calls } = replay()
  await assert.rejects(run({ ...options, maxRequests: 4 }), /request budget reached/)
  assert.equal(calls.length, 4)
  assert.equal(calls.includes(inventoryURL), false)
})

test('caller cancellation also bounds an injected text reader which never settles', async () => {
  const controller = new AbortController(), reason = Error('caller stopped SecPod replay')
  const task = run({ signal: controller.signal, requestIntervalMs: 0, fetchText: async url => {
    if (url === 'https://www.secpod.com/careers') return originalBody(packets.get(url))
    controller.abort(reason)
    return new Promise(() => {})
  } })
  await assert.rejects(task, error => error === reason)
})

test('an oversized native HTTP body fails with a retained contract error', async () => {
  await assert.rejects(run({ requestIntervalMs: 0, fetchImpl: async url => {
    const response = new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new Uint8Array(16 * 1024 * 1024 + 1))
      controller.close()
    } }), { status: 200, headers: { 'content-type': 'text/html' } })
    Object.defineProperty(response, 'url', { value: url })
    return response
  } }), error => error?.code === 'SECPOD_NATIVE_CONTRACT' && /byte budget/.test(error.message))
})
