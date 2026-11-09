import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run as runAmi, LINKEDIN_COMPANY_PAGE_URL, LINKEDIN_INDIA_JOBS_URL } from '../../scraper/ami/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const sources = ['abinbevgccindia', 'actaai', 'altenindia', 'anaptycodeemy', 'arms4ai', 'bootlabstechnologies', 'convinai', 'snapdeal', 'superagi', 'trell', 'vedantu', 'werize']
const card = ({ id = '222', company = 'Example', dateClass = 'job-search-card__listdate--new', complete = true } = {}) => `<div class="base-card job-search-card" data-entity-urn="urn:li:jobPosting:${id}"><a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/${id}">View</a>${complete ? `<h3 class="base-search-card__title">Software &amp; Platform Engineer</h3><h4 class="base-search-card__subtitle"><a>${company}</a></h4><span class="job-search-card__location">Bengaluru, India</span><time class="${dateClass}" datetime="2026-10-28">Today</time>` : ''}</div>`

// AMI retains guest-search cards as unqualified observations through its public
// run contract. Preserve the same date and card-isolation checks on that path.
const amiPackets = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/ami/test-data/native-20261103.json.gz', import.meta.url))))
const amiPages = new Map(amiPackets.map(packet => [packet.requestedUrl, packet]))
const observeAmiCards = async html => {
  const calls = []
  let audit
  const jobs = await runAmi({
    fetchPage: async url => {
      assert.ok(amiPages.has(url), `Unexpected AMI request: ${url}`)
      calls.push(url)
      const packet = structuredClone(amiPages.get(url))
      if (url === LINKEDIN_INDIA_JOBS_URL) packet.html = packet.html.replace('</body>', html + '</body>')
      return packet
    },
    onAudit: value => { audit = value },
  })
  assert.deepEqual(calls, [LINKEDIN_COMPANY_PAGE_URL, LINKEDIN_INDIA_JOBS_URL, LINKEDIN_COMPANY_PAGE_URL, LINKEDIN_INDIA_JOBS_URL])
  assert.equal(audit.closingReconciled, true)
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  for (const record of audit.observedCandidates) {
    assert.equal(record.company, null)
    assert.equal(record.country, null)
    assert.equal(record.postingDate, null)
    assert.equal(record.sourceCurrentNativeRoleQualified, false)
    assert.equal(record.lifecycleCleanupAllowed, false)
  }
  return audit.observedCandidates
}

test('ami preserves native dates on current LinkedIn new-date cards', async () => {
  const records = await observeAmiCards(card())
  assert.equal(records.length, 1)
  assert.equal(records[0].jobId, '222')
  assert.equal(records[0].sourceNativePostingDateTime, '2026-10-28')
  assert.equal(records[0].title, 'Software & Platform Engineer')
})

test("ami never borrows a later card's title, employer, location or date", async () => {
  const records = await observeAmiCards(card({ id: '111', complete: false }) + card({ dateClass: 'job-search-card__listdate' }))
  assert.deepEqual(records.map(record => record.jobId), ['222'])
  assert.equal(records[0].sourceUrl, 'https://www.linkedin.com/jobs/view/222')
  assert.equal(records[0].title, 'Software & Platform Engineer')
  assert.equal(records[0].sourceNativeObservedEmployer, 'Example')
  assert.equal(records[0].sourceNativeObservedLocation, 'Bengaluru, India')
  assert.equal(records[0].sourceNativePostingDateTime, '2026-10-28')
})

for (const source of sources) {
  const module = await import(`../../scraper/${source}/script.js`)
  const extract = module.extractSearchResults || module.extractIndiaJobListings
  const company = module.OFFICIAL_BRAND_NAME || module.COMPANY || 'Example'
  test(`${source} preserves native dates on current LinkedIn new-date cards`, () => {
    const jobs = extract('<html><body>' + card({ company }) + '</body></html>')
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].jobId, '222')
    assert.equal(jobs[0].postingDate, '2026-10-28')
    assert.equal(jobs[0].title, 'Software & Platform Engineer')
  })
  test(`${source} never borrows a later card's title, employer, location or date`, () => {
    const html = '<html><body>' + card({ id: '111', complete: false }) + card({ company, dateClass: 'job-search-card__listdate' }) + '</body></html>'
    const jobs = extract(html)
    assert.deepEqual(jobs.map(job => job.jobId), ['222'])
    assert.equal(jobs[0].sourceUrl, 'https://www.linkedin.com/jobs/view/222')
  })
}
