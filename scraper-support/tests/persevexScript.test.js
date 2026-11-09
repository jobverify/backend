import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../utils/sourceObservationEvidence.js'
const loadPersevexModule = () => import('../../scraper/persevex/script.js')
const fixture = name => readFileSync(new URL('../../scraper/persevex/fixtures/' + name, import.meta.url), 'utf8')
const home = Buffer.from(JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/persevex/fixtures/current-public-20261105.compact.json.gz', import.meta.url)))).receipts.find(row => row.transport === 'chrome-alternate-public-document' && row.url === 'https://www.persevex.com/').bodyBase64, 'base64').toString('utf8')
const careers = fixture('current-careers.html'), client = fixture('persevex-careers-client.js')

test('Persevex validates published role details, marks partial India coverage and preserves unresolved geography', async () => {
  const source = await loadPersevexModule()
  assert.equal(source.SOURCE, 'persevex')
  assert.equal(source.hasOfficialHomepageSignal(home), true)
  assert.equal(source.hasOfficialCareersSignal(careers), true)
  const jobs = source.extractPublicJobs(careers, client)
  assert.equal(jobs.length, 3)
  assert.ok(jobs.every(job => job.publicExperienceChecked === true && job.sourceListingComplete === false && job.country === 'India'))
  assert.deepEqual(new Set(jobs.map(job => job.requisitionId)), new Set(['fe-dev', 'content-lead', 'bd-exec']))
  const frontend = jobs.find(job => job.jobId === 'fe-dev')
  assert.match(frontend.jobDescription, /^Build and maintain the Persevex web platform/)
  assert.match(frontend.jobDescription, /Eye for detail and animation/)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 6)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 3)
  assert.match(readInventoryEvidence(jobs).reason, /social-intern.*Remote/)
  assert.throws(() => source.extractPublicJobs(careers), /published.*client/i)
})

test('Persevex run decorates exact jobs while retaining inventory evidence and incomplete-listing flags', async () => {
  const source = await loadPersevexModule()
  const clientUrl = source.extractPublishedClientUrl(careers)
  const pages = new Map([[source.HOMEPAGE_URL, home], [source.CAREERS_URL, careers], [clientUrl, client]])
  const requested = []
  const jobs = await source.run({ fetchPage: async url => {
    requested.push(url)
    assert.ok(pages.has(url), 'Unexpected Persevex URL')
    return { status: 200, url, html: pages.get(url) }
  } })
  assert.deepEqual(requested, [source.HOMEPAGE_URL, source.CAREERS_URL, clientUrl, source.HOMEPAGE_URL, source.CAREERS_URL, clientUrl])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, source.SOURCE)
  assert.equal(jobs[0].companyCareerPage, source.CAREERS_URL)
  assert.ok(jobs.every(job => typeof job.scrapedAt === 'string' && job.sourceListingComplete === false))
  assert.equal(readInventoryEvidence(jobs).pagesFetched, 6)
  await assert.rejects(source.run({ fetchPage: async url => ({ status: 200, url: 'https://unrelated.example/', html: home }) }), /URL.*identity/i)
})

test('Registered Persevex retains full source observations and unresolved countries through catalog decoration', async () => {
  const source = await loadPersevexModule()
  const { getScraperCatalog, createCatalogScraper } = await import('../providers/index.js')
  const receipts = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/persevex/fixtures/current-public-20261105.compact.json.gz', import.meta.url)))).receipts.filter(row => row.transport === 'chrome-alternate-public-document')
  const pages = new Map(receipts.map(row => [row.url, { status: row.status, url: row.finalUrl, html: Buffer.from(row.bodyBase64, 'base64').toString('utf8') }]))
  const jobs = await createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'persevex')).run({ fetchPage: async url => {
    assert.ok(pages.has(url))
    return pages.get(url)
  } })
  assert.equal(jobs.length, 3)
  const report = source.readPersevexReport(jobs)
  assert.equal(report.rawJobs, 6)
  assert.equal(report.closingMatches, true)
  assert.deepEqual(report.unresolvedRoles.map(role => role.id), ['placement-exec', 'social-intern', 'hr-exec'])
  assert.deepEqual(readSourceObservationEvidence(jobs, 'persevex'), { source: 'persevex', recordKind: 'vacancy-rows', observedRecordCount: 6, observedVacancyCount: 6, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
