import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import * as adapter from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { extractNativeDetail } from './native.js'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
const { createLetsTransportScraper } = adapter

const careers = 'https://letstransport.in/we-are-hiring/'
const response = (body, status = 200, url = careers) => ({ status, url, text: async () => body })
const gap = error => {
  assert.equal(error.code, 'LETSTRANSPORT_COVERAGE_GAP')
  assert.equal(error.sourceListingComplete, false)
  assert.equal(error.sourceScopeComplete, false)
  assert.equal(error.lifecycleCleanupAllowed, false)
  assert.equal(error.inventoryEvidence.status, 'coverage-gap')
  assert.equal(error.inventoryEvidence.listingComplete, false)
  assert.equal(error.inventoryEvidence.reportedTotal, null)
  assert.equal(error.inventoryEvidence.indiaFacetCount, null)
  return true
}

const nativeCaptures = () => {
  const rows = JSON.parse(readFileSync(new URL('./fixtures/linkedin-native-details.json', import.meta.url)))
  const canonical = JSON.parse(readFileSync(new URL('./fixtures/canonical-native-details.json', import.meta.url)))
  const official = JSON.parse(readFileSync(new URL('./fixtures/official-hiring.json', import.meta.url)))
  return [official, ...canonical, ...rows]
}
const captureFetch = rows => async url => {
  const row = rows.find(r => r.url === url)
  assert.ok(row, `Uncaptured request ${url}`)
  const receipt = new Response(row.body, { status: row.status, headers: { 'content-type': 'text/html' } })
  Object.defineProperty(receipt, 'url', { value: row.finalUrl })
  return receipt
}

test('native replay recovers both active India internships while retaining partial scope', async () => {
  const result = await createLetsTransportScraper().run({ fetchImpl: captureFetch(nativeCaptures()) })
  assert.deepEqual(result.map(j => [j.jobId, j.city, j.state, j.country, j.postingDate, j.closingDate]), [
    ['4475899742', 'Chennai', 'Tamil Nadu', 'India', '2026-10-06', null],
    ['4475888982', 'Bengaluru', 'Karnataka', 'India', '2026-10-06', null],
  ])
  for (const job of result) {
    assert.equal(job.employmentType, 'Internship')
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.match(job.jobDescription, /Monitoring and updating data in MS-Excel/)
    assert.equal(job.applicationRequiresAccount, true)
  }
  const evidence = readInventoryEvidence(result)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
})

test('a throttled internship detail preserves the other verified role as partial', async () => {
  const normal = captureFetch(nativeCaptures())
  const result = await createLetsTransportScraper().run({ fetchImpl: async url => url.includes('4475888982') ? response('rate limited', 429, url) : normal(url) })
  assert.deepEqual(result.map(j => j.jobId), ['4475899742'])
  assert.match(readInventoryEvidence(result).reason, /429/)
})

test('stream byte cap cancels body before accepting an unbounded response', async () => {
  let cancelled = false, reads = 0
  await assert.rejects(createLetsTransportScraper().run({ fetchImpl: async url => ({ status: 200, url,
    body: { getReader: () => ({ read: async () => { reads++; return { done: false, value: new Uint8Array(1024 * 1024) } }, cancel: async () => { cancelled = true }, releaseLock() {} }) },
    text: () => { throw Error('must use bounded streaming') },
  }) }), gap)
  assert.equal(cancelled, true)
  assert.equal(reads, 6)
})

test('hidden, inert, template and heading-only descriptions remain null', () => {
  const rows = nativeCaptures(), detail = rows.find(r => r.url.includes('4475899742'))
  const listing = rows.find(r => r.url.includes('jobs-worldwide'))
  const card = adapter.extractNativeCards(listing.body).find(r => r.id === '4475899742')
  const page = document(detail.body), node = page.nodes(n => page.hasClass(n, 'show-more-less-html__markup'))[0]
  const prose = 'A sufficiently lengthy heading explaining responsibilities and requirements without providing any actual substantive description. '.repeat(4)
  for (const inner of [`<p><strong>${prose}</strong></p>`, `<p style="content-visibility: hidden">${prose}</p>`, `<template><p>${prose}</p></template>`, `<p inert>${prose}</p>`, `<h2>${prose}</h2>`]) {
    const changed = detail.body.slice(0, node.openEnd) + inner + detail.body.slice(node.closeStart)
    assert.equal(extractNativeDetail(changed, card, '2026-10-23T07:00:00Z').jobDescription, null)
  }
})

test('native structured secondary foreign geography cannot be ignored', () => {
  const rows = nativeCaptures(), detail = rows.find(r => r.url.includes('4475899742'))
  const card = adapter.extractNativeCards(rows.find(r => r.url.includes('jobs-worldwide')).body).find(r => r.id === '4475899742')
  const schema = { '@type': 'JobPosting', title: card.title, jobLocation: [{ address: { addressCountry: 'IN' } }, { address: { addressCountry: 'SG' } }] }
  assert.throws(() => extractNativeDetail(detail.body + `<script type="application/ld+json">${JSON.stringify(schema)}</script>`, card, '2026-10-23T07:00:00Z'))
})

test('LetsTransport unavailable official careers does not certify empty inventory', async () => {
  await assert.rejects(createLetsTransportScraper().run({ fetchImpl: async () => response('Bad Gateway', 502) }), gap)
})

test('fresh exact employer native listing enumerates all eight cards including both India internships', () => {
  const capture = JSON.parse(readFileSync(new URL('./fixtures/linkedin-requested-listing.json', import.meta.url)))
  assert.equal(typeof adapter.extractNativeCards, 'function')
  const cards = adapter.extractNativeCards(capture.body)
  assert.equal(cards.length, 8)
  assert.deepEqual(cards.slice(-2).map(r => [r.id, r.location]), [
    ['4475899742', 'Chennai, Tamil Nadu, India'], ['4475888982', 'Bengaluru, Karnataka, India'],
  ])
})

test('unknown markup and redirects cannot certify zero jobs', async () => {
  for (const input of [response('<h1>No jobs available</h1>'), response('<h1>LetsTransport</h1>', 200, 'https://other.example/')]) {
    await assert.rejects(createLetsTransportScraper().run({ fetchImpl: async () => input }), gap)
  }
})

test('aggregate deadline bounds both noncooperative fetch and body', async () => {
  for (const bodyHangs of [false, true]) {
    let upstreamSignal
    await assert.rejects(createLetsTransportScraper().run({ timeoutMs: 20, fetchImpl: async (url, options) => {
      upstreamSignal = options.signal
      return bodyHangs ? { status: 200, url, text: () => new Promise(() => {}) } : new Promise(() => {})
    } }), gap)
    assert.equal(upstreamSignal.aborted, true)
  }
})

test('caller abort preserves exact reason before and during fetch', async () => {
  for (const alreadyAborted of [true, false]) {
    const controller = new AbortController(), reason = new Error('caller cancellation')
    let calls = 0
    if (alreadyAborted) controller.abort(reason)
    const pending = createLetsTransportScraper().run({ signal: controller.signal, fetchImpl: async () => { calls++; return new Promise(() => {}) } })
    if (!alreadyAborted) controller.abort(reason)
    await assert.rejects(pending, error => error === reason)
    assert.equal(calls, alreadyAborted ? 0 : 1)
  }
})

test('invalid timeout is rejected before transport', async () => {
  let calls = 0
  await assert.rejects(createLetsTransportScraper().run({ timeoutMs: 2 ** 32, fetchImpl: async () => { calls++; return response('') } }), gap)
  assert.equal(calls, 0)
})

test('oversized and failed body reads remain gaps and preserve transport cause', async () => {
  await assert.rejects(createLetsTransportScraper().run({ fetchImpl: async () => response('x'.repeat(5 * 1024 * 1024 + 1)) }), gap)
  const failure = new Error('body read failed')
  await assert.rejects(createLetsTransportScraper().run({ fetchImpl: async () => ({ status: 200, url: careers, text: async () => { throw failure } }) }), error => {
    gap(error)
    assert.equal(error.cause, failure)
    assert.equal(error.inventoryEvidence.pagesFetched, 1)
    return true
  })
})

test('email invitation is recruitment evidence but never proves inventory empty', async () => {
  await assert.rejects(createLetsTransportScraper().run({ fetchImpl: async () => response('<h1>LetsTransport</h1><p>Send your resume to recruitment@letstransport.team</p>') }), error => {
    gap(error)
    assert.match(error.message, /Resume-email recruitment surface/)
    return true
  })
  for (const inactive of ['<!-- recruitment@letstransport.team -->', '<template>recruitment@letstransport.team</template>', '<span hidden>recruitment@letstransport.team</span>']) {
    await assert.rejects(createLetsTransportScraper().run({ fetchImpl: async () => response(inactive) }), error => {
      gap(error)
      assert.match(error.message, /surface changed/)
      return true
    })
  }
})

test('importing with unrelated --dry-run cannot start network or persistence', () => {
  const url = new URL('./script.js', import.meta.url).href
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `import fs from 'node:fs'; fs.writeFileSync=()=>{throw Error('unexpected persistence')}; process.argv.push('--dry-run'); globalThis.fetch=()=>{throw Error('unexpected network')}; await import(${JSON.stringify(url)}); console.log('safe import')`], { encoding: 'utf8', timeout: 3000 })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), 'safe import')
})

test('retained raw and gzip browser captures match manifest SHA256 hashes', () => {
  const manifest = JSON.parse(readFileSync(new URL('./fixtures/manifest.json', import.meta.url)))
  const sha = body => createHash('sha256').update(body).digest('hex')
  for (const fixture of manifest.fixtures) {
    const raw = readFileSync(new URL('./fixtures/' + fixture.file, import.meta.url))
    const compressed = readFileSync(new URL('./fixtures/' + fixture.compressedFile, import.meta.url))
    assert.equal(sha(raw), fixture.sha256)
    assert.equal(sha(compressed), fixture.compressedSha256)
    assert.deepEqual(gunzipSync(compressed), raw)
    const parsed = JSON.parse(raw), rows = Array.isArray(parsed) ? parsed : [parsed]
    assert.deepEqual(rows.map(r => typeof r.body === 'string' ? sha(r.body) : null), fixture.responses.map(r => r.bodySha256))
  }
})
