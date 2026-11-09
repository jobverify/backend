import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

globalThis.fetch = () => { throw new Error('Agiloft India tests prohibit network before imports') }
const { getScraperCatalog, createCatalogScraper } = await import('../../scraper-support/providers/index.js')
const { readInventoryEvidence } = await import('../../scraper-support/utils/inventoryEvidence.js')
const agiloft = await import('./script.js')
const corpus = JSON.parse(fs.readFileSync(new URL('./fixtures/native-corpus.json', import.meta.url)))
const feed = corpus.feed
const provider = () => getScraperCatalog().find(p => p.source === 'agiloftindia')

const runCorpus = async ({ payloads = [feed, feed], pages = corpus.pages, maxJobs } = {}) => {
  const requests = []; let jsonIndex = 0; let audit
  const jobs = await createCatalogScraper(provider()).run({
    now: () => '2026-10-27T09:00:00.000Z', maxJobs,
    fetchPage: async url => { requests.push(url); assert.ok(pages[url], `Unexpected native page ${url}`); return { status: 200, url: url === agiloft.CAREERS_URL ? 'https://www.agiloft.com/careers' : url, html: pages[url] } },
    fetchJson: async url => { requests.push(url); assert.equal(url, agiloft.LEVER_API_URL); assert.ok(jsonIndex < payloads.length, 'Unexpected extra API request'); return structuredClone(payloads[jsonIndex++]) },
    onNativeAudit: value => { audit = value },
  })
  return { jobs, audit, requests, evidence: readInventoryEvidence(jobs) }
}

test('Agiloft India actual native fixture: registered zero India result has full detail and closing inventory evidence', async () => {
  const { jobs, audit, evidence } = await runCorpus()
  assert.deepEqual(jobs, [])
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 12)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(audit.complete, true)
  assert.equal(audit.fullyHealthyCount, 12)
  assert.equal(audit.rows.length, 12)
  assert.deepEqual(audit.rows[0].workCountries, ['United States'])
  assert.equal(audit.rows[0].requisitionId, null)
  assert.equal(audit.rows[0].company, 'Agiloft')
  assert.equal(audit.rows[0].city, null)
  assert.match(audit.rows[0].jobDescription, /Pipeline Generation & Market Activation/)
  assert.match(audit.rows[0].jobDescription, /Applicants from underrepresented groups/)
})

test('Agiloft India actual native fixture: full description includes every list and additional section', () => {
  const india = structuredClone(feed[0])
  india.country = 'IN'; india.categories.location = 'India'; india.categories.allLocations = ['India']
  const [job] = agiloft.extractLeverJobs([india])
  assert.match(job.jobDescription, /Pipeline Generation & Market Activation/)
  assert.match(job.jobDescription, /Required Qualifications/)
  assert.match(job.jobDescription, /Applicants from underrepresented groups/)
  assert.equal(job.requisitionId, null)
  assert.equal(job.city, null)
})

test('Agiloft India stops before native requests when a corporate page does not advertise the hiring handoff', async () => {
  const pages = { ...corpus.pages, [agiloft.CAREERS_URL]: '<title>Agiloft careers</title><h1>Level up with us</h1><p>Financial career growth</p><footer>Agiloft Inc</footer>' }
  await assert.rejects(runCorpus({ pages }), /handoff|advertis/i)
})

test('Agiloft India corporate section anchors do not become extra hiring locales', () => {
  const channels = agiloft.extractCareersChannels(`${corpus.pages[agiloft.CAREERS_URL]}<a href="#open-roles">Open roles</a><a href="/careers/#financial-career-growth">Growth</a>`)
  assert.deepEqual(channels.locales, [])
})
