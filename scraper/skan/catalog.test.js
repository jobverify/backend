import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { SKAN_CATALOG } from './catalog.js'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../../scraper-support/providers/index.js'
import { run } from './script.js'

test('Skan resolves only to its exact-name first-party provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nSkan\nSkanray Technologies\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Skan', 'skan', 'Skan'],
      ['Skanray Technologies', 'skanraytechnologies', 'Skanray Technologies'],
    ],
  )
})

test('Skan local catalog and captured current native careers remain deterministic', async () => {
  const read = name => JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/${name}.json.gz`, import.meta.url))))
  const active = JSON.parse(readFileSync(new URL('./fixtures/additional-native-api-pages.json', import.meta.url)))[0]
  const captures = [read('careers-response'), ...read('detail-responses'), active]
  const jobs = await run({ now: active.capturedAt, fetchText: async url => { const capture = captures.find(row => row.url === url); assert.ok(capture, url); return capture.body } })
  assert.equal(jobs.length, 16)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 65)
  assert.equal(SKAN_CATALOG.inventoryVerificationPolicy, 'live-parser-evidence-required')
  assert.equal(SKAN_CATALOG.atsPlatform, 'keka')
  assert.equal(SKAN_CATALOG.verifiedPublicJobCount, null)
  assert.equal(SKAN_CATALOG.verifiedIndiaJobCount, null)
  assert.equal(SKAN_CATALOG.observedNativePublicJobCount, 64)
  assert.equal(SKAN_CATALOG.observedIndiaCandidates, 16)
  assert.equal(SKAN_CATALOG.lifecycleCleanupAllowed, false)
})
