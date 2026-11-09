import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as coupa from '../../scraper/coupasoftwareinc/script.js'

// Reduced first-party HTTP 200 captures from 2026-10-29. Full raw capture
// hashes are retained in roles.json; the native JobPosting text is unchanged.
const roles = JSON.parse(readFileSync(new URL('./fixtures/coupasoftwareinc/roles.json', import.meta.url), 'utf8'))
const page = job => ({ status: 200, url: job.sourceUrl, html: readFileSync(new URL('./fixtures/coupasoftwareinc/' + job.fixture, import.meta.url), 'utf8') })
const listing = `<title>Jobs - Explore opportunities to make an impact. | Coupa Careers</title><h1>Shape your career at Coupa</h1><p>Displaying 1 to 2 of 2 matching jobs</p>${roles.map(job => `<article><h2><a href="${job.sourceUrl}">${job.title}</a></h2><ul><li>Pune, India</li><li>${job.department}</li><li>Hybrid</li></ul></article>`).join('')}`

test('Coupa hydrates the two captured exact public roles from their native schema', async () => {
  const jobs = await coupa.createCoupaSoftwareIncScraper().run({
    fetchText: async () => listing,
    fetchDetailPage: async url => page(roles.find(job => job.sourceUrl === url)),
  })
  assert.equal(jobs.length, 2)
  assert.ok(jobs.every(job => job.sourceDetailComplete === true && job.sourceListingComplete === false))
  assert.match(jobs.find(job => job.jobId === '11944').sourceDescription, /Payroll Specialist/)
  assert.match(jobs.find(job => job.jobId === '11936').sourceDescription, /AI-first QE/)
  assert.ok(jobs.every(job => job.jobDescription === job.sourceDescription))
  assert.equal(jobs.find(job => job.jobId === '11944').sourcePostingDate, '2026-10-19')
  assert.equal(jobs.find(job => job.jobId === '11936').sourcePostingDate, '2026-10-14')
  assert.ok(jobs.every(job => job.sourceDateEvidence === 'coupa-canonical-jobposting-dates-v1'))
})

test('Coupa native detail requires matching employer, numeric requisition, UUID, title, canonical URL and India location', () => {
  const job = roles[0], response = page(job)
  assert.ok(coupa.extractCoupaJobDescription(job, response)?.sourceDescription)
  const schema = JSON.parse(response.html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])
  const replaceSchema = record => ({ ...response, html: response.html.replace(/(<script type="application\/ld\+json">)[\s\S]*?(<\/script>)/, (_, start, end) => start + JSON.stringify(record) + end) })
  for (const record of [
    { ...schema, title: 'An unrelated role' },
    { ...schema, identifier: 'another-native-id' },
    { ...schema, hiringOrganization: { ...schema.hiringOrganization, name: 'Another employer' } },
    { ...schema, hiringOrganization: { ...schema.hiringOrganization, url: 'https://another.example/' } },
    { ...schema, jobLocation: { ...schema.jobLocation, address: { ...schema.jobLocation.address, addressCountry: 'United States' } } },
    { ...schema, jobLocation: [{ ...schema.jobLocation }, { address: { addressCountry: 'United States' } }] },
    { ...schema, datePosted: '2026-02-31' },
  ]) assert.equal(coupa.extractCoupaJobDescription(job, replaceSchema(record)), null)
  for (const changed of [
    { ...response, status: 403 },
    { ...response, url: 'https://careers.coupa.com/en/jobs/' },
    { ...response, html: response.html.replace('rel="canonical"', 'rel="alternate"') },
    { ...response, html: response.html.replace('id="js-job-detail"', 'id="unrelated"') },
    { ...response, html: '<template>' + response.html + '</template>' },
    { ...response, html: '<!--' + response.html + '-->' },
  ]) assert.equal(coupa.extractCoupaJobDescription(job, changed), null)
  assert.equal(coupa.extractCoupaJobDescription({ ...job, jobId: '11936' }, response), null)
  assert.equal(coupa.extractCoupaJobDescription({ ...job, company: 'Another employer' }, response), null)
  const empty = coupa.extractCoupaJobDescription(job, replaceSchema({ ...schema, description: '<p>&nbsp;</p>' }))
  assert.equal(empty.sourceDescription, null)
  assert.equal(empty.sourcePostingDate, '2026-10-19')
})

test('Coupa retains explicit incomplete detail after a blocked response or zero budget', async () => {
  for (const detailEnrichmentBudgetMs of [0, 1000]) {
    const jobs = await coupa.createCoupaSoftwareIncScraper().run({
      detailEnrichmentBudgetMs, fetchText: async () => listing,
      fetchDetailPage: async url => ({ status: 403, url, html: '<title>Just a moment...</title>' }),
    })
    assert.ok(jobs.every(job => job.sourceDetailComplete === false && !job.sourceDescription))
  }
})

test('Coupa retains verified native dates even when the employer description is empty', async () => {
  const jobs = await coupa.createCoupaSoftwareIncScraper().run({
    fetchText: async () => listing,
    fetchDetailPage: async url => {
      const response = page(roles.find(job => job.sourceUrl === url))
      const schema = JSON.parse(response.html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])
      schema.description = ''
      return { ...response, html: response.html.replace(/(<script type="application\/ld\+json">)[\s\S]*?(<\/script>)/, (_, start, end) => start + JSON.stringify(schema) + end) }
    },
  })
  assert.ok(jobs.every(job => job.sourceDetailComplete === false && !job.sourceDescription))
  assert.equal(jobs.find(job => job.jobId === '11944').sourcePostingDate, '2026-10-19')
  assert.equal(jobs.find(job => job.jobId === '11936').sourcePostingDate, '2026-10-14')
})

test('Coupa pre-aborted collection makes no listing or detail request', async () => {
  const controller = new AbortController()
  controller.abort(new Error('Caller cancelled'))
  let requested = false
  await assert.rejects(coupa.createCoupaSoftwareIncScraper().run({
    signal: controller.signal, fetchText: async () => { requested = true; return listing },
  }), /Caller cancelled/)
  assert.equal(requested, false)
})
