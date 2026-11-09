import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { getScraperCatalog, createCatalogScraper } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const discoveryRows = JSON.parse(readFileSync(new URL('../scraper-support/providers/providerExtensions/zzzzz-verified-discovery-adapters.json', import.meta.url)))
const discoveryArchiveDir = new URL('../../artifacts/full-catalog/official-discovery/', import.meta.url)

const boards = {
  amgen: ['amgen.wd1.myworkdayjobs.com', 'Careers'],
  alfalaval: ['alfalaval.wd3.myworkdayjobs.com', 'Alfa_Laval_jobs'],
  ameriprisefinancial: ['ameriprise.wd5.myworkdayjobs.com', 'Ameriprise'],
  aig: ['aig.wd1.myworkdayjobs.com', 'aig'],
  aiagroup: ['aia.wd3.myworkdayjobs.com', 'External'],
  albemarle: ['albemarle.wd5.myworkdayjobs.com', 'External'],
  alcoa: ['alcoa.wd5.myworkdayjobs.com', 'Careers'],
  alliantenergy: ['alliantenergy.wd1.myworkdayjobs.com', 'alliant'],
  aritzia: ['aritzia.wd3.myworkdayjobs.com', 'External'],
}

test('verified discoveries replace exact sentinels without adding sources or duplicate boards', () => {
  const catalog = getScraperCatalog()
  for (const [source, [host, site]] of Object.entries(boards)) {
    const rows = catalog.filter(row => row.source === source)
    assert.equal(rows.length, 1)
    const row = rows[0]
    assert.equal(row.adapter, 'workday', source)
    assert.equal(new URL(row.baseUrl).hostname, host)
    assert.equal(new URL(row.baseUrl).pathname.split('/').at(-1), site)
    assert.equal(row.boardIdentityVerified, true)
    assert.equal(catalog.filter(other => other.adapter === 'workday'
      && other.baseUrl && new URL(other.baseUrl).hostname === host
      && new URL(other.baseUrl).pathname.split('/').at(-1) === site).length, 1)
  }
  assert.equal(catalog.filter(row => row.source === 'armorcode').length, 1)
  const armorcode = catalog.find(row => row.source === 'armorcode')
  assert.equal(armorcode.adapter, 'publicAts')
  assert.equal(armorcode.boardToken, 'armorcode')
})

test('new bindings retain official proof references and keep runtime counts unknown', () => {
  const rows = discoveryRows
  assert.equal(rows.length, 10)
  for (const row of rows) {
    assert.equal(row.bindingEvidence.verified, true)
    assert.ok(row.bindingEvidence.matchedLinks.length)
    for (const proof of row.bindingEvidence.proofFiles) {
      assert.match(proof, /^proof\/[a-z\d-]+\.json$/i, `${row.source}: proof should reference a discovery archive file`)
    }
    assert.ok(row.bindingEvidence.proofFiles.length)
    assert.equal(row.verifiedPublicJobCount, null)
    assert.equal(row.verifiedIndiaJobCount, null)
    assert.equal(row.verifiedInventoryStatus, 'unverified')
    assert.equal(row.remediationStatus, 'implemented-awaiting-live-validation')
  }
  assert.match(rows.find(row => row.source === 'amgen').bindingEvidence.bindingMethod, /application/)
  assert.match(rows.find(row => row.source === 'aig').verifiedSurfaceSummary, /Tata/i)
  assert.match(rows.find(row => row.source === 'aiagroup').verifiedSurfaceSummary, /Tata/i)
})

test('official binding proof files exist when the external discovery archive is available', (t) => {
  if (!existsSync(discoveryArchiveDir)) {
    t.skip('Optional artifacts/full-catalog/official-discovery archive is not present')
    return
  }
  for (const row of discoveryRows) {
    for (const proof of row.bindingEvidence.proofFiles) {
      assert.ok(existsSync(new URL(proof, discoveryArchiveDir)), `${row.source}: ${proof}`)
    }
  }
})

test('Amgen has bounded source-specific detail and runner budgets for its observed large India inventory', () => {
  const provider = getScraperCatalog().find(row => row.source === 'amgen')
  const config = JSON.parse(readFileSync(path.join(provider.sourceDirectory, 'config.json')))
  assert.equal(config.detailEnrichmentBudgetMs, 300000)
  assert.equal(provider.scraperTimeoutMs, 540000)
  assert.equal(provider.sourceLifecycleTimeoutMs, 600000)
  assert.ok(provider.scraperTimeoutMs > config.detailEnrichmentBudgetMs)
  assert.ok(provider.sourceLifecycleTimeoutMs > provider.scraperTimeoutMs)
})

test('ArmorCode executes only its official Greenhouse board and retains full inventory versus India distinction', async () => {
  const provider = getScraperCatalog().find(row => row.source === 'armorcode')
  const jobs = await createCatalogScraper(provider).run({ fetchJson: async url => {
    assert.match(url, /^https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/armorcode\/jobs\?content=true$/)
    return { meta: { total: 1 }, jobs: [{
      id: 123, title: 'Software Engineer', location: { name: 'United States' },
      absolute_url: 'https://job-boards.greenhouse.io/armorcode/jobs/123',
      content: '<p>Build application security software.</p>',
    }] }
  } })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs)?.status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 1)
})

for (const [source, [host, site]] of Object.entries(boards)) {
  test(`${source} executes the exact CXS site and observed country facet contract`, async t => {
    const facet = ({ amgen: 'LocationCountry', alcoa: 'Location_Country', aritzia: 'Location_Country' })[source] || 'locationCountry'
    const unfiltered = ['albemarle', 'alliantenergy'].includes(source)
    let calls = 0
    t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
      if (options.method !== 'POST') return new Response('<html>Careers</html>')
      calls += 1
      assert.equal(String(url), `https://${host}/wday/cxs/${host.split('.')[0]}/${site}/jobs`)
      assert.deepEqual(JSON.parse(options.body).appliedFacets,
        unfiltered ? {} : { [facet]: ['c4f78be1a8f14da0ab49ce1162348a5e'] })
      return new Response(JSON.stringify({ total: 0, jobPostings: [], facets: unfiltered ? [] : [{
        facetParameter: facet, descriptor: 'Country',
        values: [{ descriptor: 'India', id: 'c4f78be1a8f14da0ab49ce1162348a5e', count: 0 }],
      }] }), { headers: { 'content-type': 'application/json' } })
    })
    const jobs = await createCatalogScraper(getScraperCatalog().find(row => row.source === source)).run()
    assert.equal(calls, 1)
    assert.equal(jobs.length, 0)
    // An empty board with no explicit country evidence remains conservatively unknown.
    assert.equal(readInventoryEvidence(jobs)?.status, unfiltered ? 'unverified' : 'verified-empty')
  })
}
