import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { extractionDetailHealth } from '../../scraper-support/utils/extractionDetailHealth.js'
import { isCompleteScraperAttempt, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { inventoryCleanupOptions } from '../../scraper-support/utils/scraperOutcome.js'

const capture = JSON.parse(gunzipSync(readFileSync(new URL('./native-captures/public-scope-20261101.json.gz', import.meta.url))))
const careersURL = 'https://www.thoughtspot.com/careers'
const apiURL = 'https://www.thoughtspot.com/api/getCareersListing'
const clientURL = 'https://www.thoughtspot.com/_next/static/chunks/42179.dd76c7957fb6f98e.js'
const roleURL = 'https://ats.rippling.com/thoughtspot/jobs/ffd134bf-a6d7-4ece-bbd7-22106a07d47a'
const lastListing = capture.packets.filter(packet => packet.url === apiURL).at(-1)
let provider
const replay = (transform = packet => packet) => {
  const reads = new Map(), requests = []
  return { requests, transport: async url => {
    requests.push(url)
    const packets = capture.packets.filter(packet => packet.url === url)
    assert.ok(packets.length, 'Uncaptured current public resource: ' + url)
    const index = reads.get(url) || 0
    reads.set(url, index + 1)
    const packet = transform({ ...packets[Math.min(index, packets.length - 1)] }, index)
    if (packet instanceof Error) throw packet
    return { ...packet, body: Buffer.from(packet.body), bodyComplete: true }
  } }
}
const run = options => createCatalogScraper(provider ||= getScraperCatalog().find(item => item.source === 'thoughtspot')).run(options)
const diagnostics = jobs => {
  const inventoryEvidence = readInventoryEvidence(jobs)
  return { success: true, inventoryEvidence, completedAt: inventoryEvidence.verifiedAt,
    detailHealth: extractionDetailHealth(jobs) }
}
const checkPartial = jobs => {
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(isCompleteScraperAttempt(diagnostics(jobs)), false)
  assert.deepEqual(inventoryCleanupOptions(diagnostics(jobs)), { replaceExisting: false })
  for (const job of jobs) {
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
  }
}

test('ThoughtSpot complete current public inventory passes the existing attempt and detail gates', async () => {
  const input = replay()
  const jobs = await run(input)
  assert.equal(jobs.length, 14)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.pagesFetched, 1)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, 14)
  assert.equal(evidence.verifiedAt, lastListing.completedAt)
  assert.equal(input.requests.length, 20)
  assert.equal(isCompleteScraperAttempt(diagnostics(jobs)), true)
  assert.equal(extractionDetailHealth(jobs).complete, true)
  assert.deepEqual(inventoryCleanupOptions(diagnostics(jobs)), {})
  const batch = jobs[0].nativeCollectionEvidence
  assert.equal(batch.observedListingCount, 61)
  assert.equal(batch.listingRecords.length, 55)
  assert.equal(batch.sourceScopeComplete, true)
  assert.equal(batch.wholeCompanyScope, false)
  assert.equal(batch.cleanupAllowed, true)
  assert.equal(batch.verifiedZeroInventory, false)
  for (const job of jobs) {
    assert.equal(job.sourceListingComplete, true)
    assert.equal(job.sourceScopeComplete, true)
    assert.equal(job.lifecycleCleanupAllowed, true)
    assert.equal(job.nativeFacts.sourceScopeComplete, true)
    assert.equal(job.postingDate, null)
    assert.equal(job.nativePublicationDate, null)
    assert.equal(job.legalEmployer, null)
  }
})

for (const mode of ['missing-controller', 'changed-controller', 'additional-recruiting-surface', 'changed-page-component']) {
  test(`ThoughtSpot retains 14 independently verified roles but stays partial for ${mode}`, async () => {
    const jobs = await run(replay(packet => {
      if (packet.url === clientURL && mode === 'missing-controller') return Error('Public controller unavailable')
      if (packet.url === clientURL && mode === 'changed-controller') packet.body += '\nfetch("/api/anotherInventory")'
      if (packet.url === careersURL && mode === 'additional-recruiting-surface') {
        packet.body = packet.body.replace('</body>', '<a href="https://jobs.ashbyhq.com/another-employer">Open positions</a></body>')
      }
      if (packet.url === careersURL && mode === 'changed-page-component') {
        packet.body = packet.body.replaceAll('V3_Career_Section', 'V4_Career_Section')
      }
      return packet
    }))
    assert.equal(jobs.length, 14)
    checkPartial(jobs)
  })
}

for (const mode of ['cursor', 'count', 'unknown-country', 'failed-india-detail', 'closing-change']) {
  test(`ThoughtSpot cannot complete when ${mode} leaves public inventory evidence unresolved`, async () => {
    const jobs = await run(replay((packet, read) => {
      if (packet.url === roleURL && mode === 'failed-india-detail') return Error('Native detail unavailable')
      if (packet.url === apiURL) {
        const payload = JSON.parse(packet.body)
        if (mode === 'cursor') payload.nextCursor = 'next-current-page'
        if (mode === 'count') payload.total = 900
        if (mode === 'unknown-country') payload.data.find(row => row.locations[0].countryCode !== 'IN').locations[0].countryCode = 'ZZ'
        if (mode === 'closing-change' && read === 1) payload.data.pop()
        packet.body = JSON.stringify(payload)
      }
      return packet
    }))
    assert.ok(jobs.length > 0)
    checkPartial(jobs)
  })
}

test('ThoughtSpot complete nonempty public source with no India roles is not a globally empty inventory', async () => {
  const jobs = await run(replay(packet => {
    if (packet.url === apiURL) {
      const payload = JSON.parse(packet.body)
      payload.data = payload.data.filter(row => row.locations.every(location => location.countryCode !== 'IN'))
      packet.body = JSON.stringify(payload)
    }
    return packet
  }))
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(isCompleteScraperAttempt(diagnostics(jobs)), true)
})

test('ThoughtSpot globally empty source needs the same positive current delegation and full enumeration proof', async () => {
  const jobs = await run(replay(packet => {
    if (packet.url === apiURL) packet.body = '{"data":[]}'
    return packet
  }))
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'verified-empty')
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(isCompleteScraperAttempt(diagnostics(jobs)), true)
})

test('ThoughtSpot a new controller observation cannot refresh the retained source-inventory clock', async () => {
  const jobs = await run(replay(packet => {
    if (packet.url === clientURL) packet.completedAt = '2036-11-01T00:00:00.000Z'
    return packet
  }))
  assert.equal(readInventoryEvidence(jobs).verifiedAt, lastListing.completedAt)
})

for (const attribute of ['type="application/json"', 'nomodule', 'type="module; charset=utf-8"', 'language="vbscript"',
  'type="\u00a0module\u00a0"', 'type="\u00a0text/javascript\u00a0"', 'language="\u00a0"',
  'type="   "', 'language="   "', 'type=" module "', 'type="text/javascript; charset=utf-8"']) {
  test(`ThoughtSpot inert ${attribute} scripts cannot establish current controller delegation`, async () => {
    const jobs = await run(replay(packet => {
      if (packet.url === careersURL) {
        for (const asset of capture.packets.filter(row => row.url.includes('/_next/static/'))) {
          const original = packet.body
          packet.body = packet.body.replace(/<script\b[^>]*>/g, tag => tag.includes(`src="${new URL(asset.url).pathname}"`)
            ? tag.replace('<script', `<script ${attribute}`) : tag)
          assert.notEqual(packet.body, original)
        }
      }
      return packet
    }))
    assert.equal(jobs.length, 14)
    checkPartial(jobs)
  })
}

for (const [href, label] of [
  ['https://www.thoughtspot.com/open-roles', 'View all roles'],
  ['https://recruiting.paylocity.com/recruiting/all/ThoughtSpot', 'Search jobs'],
]) {
  test(`ThoughtSpot explicitly advertised additional roles at ${href} stay unresolved`, async () => {
    const jobs = await run(replay(packet => {
      if (packet.url === careersURL) packet.body = packet.body.replace('</body>', `<a href="${href}">${label}</a></body>`)
      return packet
    }))
    assert.equal(jobs.length, 14)
    checkPartial(jobs)
  })
}

for (const attribute of ['type=""', 'type=" text/javascript "', 'type="MODULE"']) {
  test(`ThoughtSpot ${attribute} executable binding preserves the complete native public proof`, async () => {
    const jobs = await run(replay(packet => {
      if (packet.url === careersURL) {
        for (const asset of capture.packets.filter(row => row.url.includes('/_next/static/'))) {
          packet.body = packet.body.replace(/<script\b[^>]*>/g, tag => tag.includes(`src="${new URL(asset.url).pathname}"`)
            ? tag.replace('<script', `<script ${attribute}`) : tag)
        }
      }
      return packet
    }))
    assert.equal(jobs.length, 14)
    assert.equal(readInventoryEvidence(jobs).listingComplete, true)
    assert.equal(isCompleteScraperAttempt(diagnostics(jobs)), true)
  })
}
