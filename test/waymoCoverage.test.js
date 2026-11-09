import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { buildIndiaSearchUrl } from '../scraper/waymo/script.js'

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const extensionPath = path.join(backendDir, 'scraper-support/providers/providerExtensions/waymo.json')
const csvText = "company_name\nWaymo\n"
const packets = JSON.parse(gunzipSync(readFileSync(new URL('../scraper/waymo/test-data/2026-10-31-native-packets.json.gz', import.meta.url))))

test('Waymo coverage matches only the literal CSV company name', () => {
  assert.equal(existsSync(extensionPath), true)

  const provider = JSON.parse(readFileSync(extensionPath, 'utf8'))
  const catalog = getScraperCatalog()
  const report = generateCompanyCoverageReport({
    csvText: csvText,
    catalog,
  })
  const nearNameReport = generateCompanyCoverageReport({
    csvText: 'company_name\nWaymo Technologies\nWaymo, Inc.\n',
    catalog,
  })

  assert.equal(provider.companyName, 'Waymo')
  assert.equal(provider.exactCompanyMatchOnly, true)
  assert.equal(provider.atsPlatform, 'clinch-first-party-careers')
  assert.deepEqual(
    report.matched.filter(({ companyName }) => companyName === 'Waymo').map((item) => item.source),
    ['waymo'],
  )
  assert.equal(nearNameReport.matchedCount, 0)
  assert.equal(nearNameReport.unmatchedCount, 2)
})

test('Waymo registered scraper replays native roles while retaining incomplete application and company scope', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('Waymo coverage tests must use captured transport'))
  const scraper = buildScrapers().find((item) => item.name === 'waymo')

  assert.ok(scraper, 'Expected Waymo scraper to be built from its provider extension')
  const requests = []
  const jobs = await scraper.run({ now: () => '2026-10-31T07:30:00.000Z', fetchText: async (url) => {
    requests.push(url)
    const packet = packets.find(row => row.url === url)
    assert.ok(packet, `Uncaptured native HTTP is forbidden: ${url}`)
    if (packet.status !== 200) throw Object.assign(new Error(`Waymo HTTP ${packet.status}`), {
      status: packet.status, requestUrl: url, finalUrl: packet.finalUrl,
    })
    return packet.body
  } })

  assert.equal(jobs.length, 3)
  assert.ok(jobs.every(job => job.company === 'Waymo' && job.source === 'waymo' && job.country === 'India'))
  assert.ok(jobs.every(job => !job.sourceDetailComplete && !job.nativeRoleClosingReconciled && job.sourceDescription.length > 1500))
  assert.ok(jobs.every(job => job.requisitionId && job.postingDate && job.nativeJobPosting.hiringOrganization.name === 'Waymo'))
  assert.equal(jobs.filter(job => job.applicationAccessValidated === false).length, 1)
  assert.equal(requests.filter(url => url === buildIndiaSearchUrl()).length, 1)
  assert.equal(requests.length, 8)
  assert.equal(packets.find(p => p.url === requests.at(-1)).status, 202)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test('Waymo registered scraper rejects unavailable native transport instead of reporting an empty inventory', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('Waymo coverage tests must use controlled transport'))
  const scraper = buildScrapers().find((item) => item.name === 'waymo')
  await assert.rejects(scraper.run({ fetchText: async () => { throw new Error('HTTP 503') } }), /HTTP 503/)
})
