import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createPublishingGapAtsScraper } from '../scraper-support/utils/publishingGapAts.js'
import test from 'node:test'
import { getScraperCatalog, createCatalogScraper } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const expected = { aspentechnology: ['script', 'aspentech'], assembled: ['publicAts', 'assembledhq'], assemblyai: ['script', 'assemblyai'] }
const providerFor = source => getScraperCatalog().find(row => row.source === source)

test('batch 002 replaces only three exact source sentinels without duplicate boards', () => {
  const catalog = getScraperCatalog()
  for (const [source, [adapter, token]] of Object.entries(expected)) {
    const rows = catalog.filter(row => row.source === source)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].adapter, adapter, source)
    if (source === 'aspentechnology') {
      assert.equal(rows[0].modulePath,fileURLToPath(new URL('../scraper/aspentechnology.workday/script.js',import.meta.url)))
      assert.ok(rows[0].nativeEmployerNames.includes('OSI Energy Automation India Private Limited'))
      assert.equal(rows[0].baseUrl, 'https://aspentech.wd5.myworkdayjobs.com/en-US/aspentech')
      assert.equal(catalog.filter(row => row.adapter === adapter && row.baseUrl?.includes('aspentech.wd5.myworkdayjobs.com/')).length, 1)
    } else {
      assert.equal(rows[0].boardToken, token)
      assert.equal(catalog.filter(row => row.adapter === adapter && row.atsPlatform === rows[0].atsPlatform && row.boardToken === token).length, 1)
      if (adapter === 'script') {
        assert.equal(rows[0].modulePath, fileURLToPath(new URL('../scraper/assemblyai/currentNative.js', import.meta.url)))
        assert.equal(rows[0].sourceScopeComplete, false)
        assert.equal(rows[0].zeroResultPolicy, 'evidence-required')
        // A source-review date and an older handoff capture do not approve whole-source inventory.
        assert.equal(rows[0].verifiedOn, '2026-10-30')
        assert.equal(rows[0].bindingEvidence.checkedAt, '2026-10-20T19:33:54.950Z')
        assert.equal(rows[0].verifiedAt, null)
        assert.equal(rows[0].verifiedInventoryStatus, 'unverified')
        assert.equal(rows[0].verifiedPublicJobCount, null)
        assert.equal(rows[0].verifiedIndiaJobCount, null)
      }
    }
  }
})

test('batch 002 binds exact hashed official HTTP captures without asserting runtime counts', () => {
  for (const source of Object.keys(expected)) {
    const row = providerFor(source)
    assert.equal(row.bindingEvidence?.httpStatus, 200, source)
    const bytes = readFileSync(new URL(row.bindingEvidence.httpProofFile, new URL('../', import.meta.url)))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), row.bindingEvidence.httpProofSha256)
    const capture = JSON.parse(bytes)
    assert.equal(capture.status, 200)
    assert.ok(capture.body.includes(row.bindingEvidence.matchedLinks[0]))
    assert.equal(row.verifiedPublicJobCount, null)
    assert.equal(row.verifiedIndiaJobCount, null)
    assert.equal(row.remediationStatus, 'implemented-awaiting-live-validation')
  }
})

for (const source of ['assembled', 'assemblyai']) {
  test(source === 'assemblyai' ? 'assemblyai generic API-model compatibility uses the configured board and excludes generic Remote from India' : `${source} uses exact native board and excludes generic Remote from India`, async () => {
    const provider = providerFor(source)
    // AssemblyAI payloads below remain generic active API-model controls, not current native admission.
    const scraper = source === 'assemblyai' ? createPublishingGapAtsScraper(provider) : createCatalogScraper(provider)
    const jobs = await scraper.run({ fetchJson: async url => {
      assert.equal(url, source === 'assembled' ? 'https://api.ashbyhq.com/posting-api/job-board/assembledhq' : 'https://boards-api.greenhouse.io/v1/boards/assemblyai/jobs?content=true')
      const records = ['Remote', 'Bengaluru, India'].map((location, index) => source === 'assembled' ? {
        id: `role-${index}`, title: 'Software Engineer', location, isListed: true,
        jobUrl: `https://jobs.ashbyhq.com/assembledhq/role-${index}`, applyUrl: `https://jobs.ashbyhq.com/assembledhq/role-${index}/application`,
        descriptionHtml: '<p>Build and maintain production services.</p>',
      } : { id: index + 1, title: 'Software Engineer', location: { name: location },
        absolute_url: `https://job-boards.greenhouse.io/assemblyai/jobs/${index + 1}`, content: '<p>Build and maintain production services.</p>' })
      return { jobs: records, meta: { total: 2 }, ...(source === 'assembled' ? { apiVersion: '1' } : {}) }
    } })
    assert.equal(jobs.length, 1)
    assert.match(jobs[0].location, /India/)
    assert.ok(jobs[0].jobDescription)
    assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 2)
    assert.equal(jobs[0].sourceListingComplete, false)
    assert.equal(readInventoryEvidence(jobs)?.status, 'discovery-only')
    assert.match(readInventoryEvidence(jobs)?.reason, /native-location-scope-unresolved/)
  })
}

test('assemblyai current registered native runtime rejects parsed-only injection before reading a feed', async () => {
  let reads = 0
  await assert.rejects(createCatalogScraper(providerFor('assemblyai')).run({
    fetchJson: async () => { reads++; assert.fail('Parsed-only controls cannot supply current native HTTP provenance') },
  }), /body-only or legacy transport unsupported; observed HTTP fetchImpl required/)
  assert.equal(reads, 0)
})
test('the legacy Workday adapter enumerates without inventing an absent country facet', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    if (options.method !== 'POST') return new Response('<html>Careers</html>')
    calls++
    assert.equal(String(url), 'https://aspentech.wd5.myworkdayjobs.com/wday/cxs/aspentech/aspentech/jobs')
    assert.deepEqual(JSON.parse(options.body).appliedFacets, {})
    return new Response(JSON.stringify({ total: 0, jobPostings: [], facets: [] }), { headers: { 'content-type': 'application/json' } })
  })
  const jobs = await createCatalogScraper({...providerFor('aspentechnology'),adapter:'workday'}).run()
  assert.equal(jobs.length, 0)
  assert.ok(calls)
  // An empty response without native country evidence cannot certify India zero.
  assert.equal(readInventoryEvidence(jobs)?.status, 'unverified')
})
