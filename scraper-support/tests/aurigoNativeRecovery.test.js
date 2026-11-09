import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as aurigo from '../../scraper/aurigo/script.js'

// Reduced from exact first-party HTTP 200 role and search responses captured
// 2026-10-29. roles.json preserves hashes of both native proof bodies.
const roles = JSON.parse(readFileSync(new URL('./fixtures/aurigo/roles.json', import.meta.url), 'utf8'))
const page = role => ({ status: 200, finalUrl: role.sourceUrl, html: readFileSync(new URL('./fixtures/aurigo/' + role.fixture, import.meta.url), 'utf8') })
const shell = '<title>Aurigo Software Technologies Jobs</title><p>Job listings Search jobs</p><script>var CSRFToken = "fixture"; var resultStyles = { currentLocale: \'en_US\' };</script><script src="/platform/js/j2w/min/j2w.searchManager.min.js"></script><a href="?searchResultView=LIST">Jobs</a>'
const payload = { totalJobs: roles.length, jobSearchResult: roles.map(role => ({ response: role.nativeListingRecord })) }

test('Aurigo uses the locale suffix required by the captured official client and canonical role URLs', () => {
  const job = aurigo.extractJobsFromApiPayload({ totalJobs: 1, jobSearchResult: [{ response: roles.find(r => r.jobId === '2313').nativeListingRecord }] })[0]
  assert.equal(job.sourceUrl, 'https://careers.aurigo.com/job/Senior-AI-Developer/2313-en_US/')
  assert.equal(job.applyUrl, job.sourceUrl)
  assert.equal(job.sourceDatePrecision, 'day')
  assert.equal(job.sourceClosingDateIsExact, false)
})

test('Aurigo recovers all ten captured native bodies with actual publication and deadline facts', async () => {
  const jobs = await aurigo.createAurigoScraper().run({
    fetchText: async () => shell, fetchJson: async () => payload,
    fetchPage: async url => {
      const role = roles.find(role => role.sourceUrl === url)
      assert.ok(role, 'Native detail request must use the real canonical route')
      return page(role)
    },
  })
  assert.equal(jobs.length, 10)
  assert.ok(jobs.every(job => job.sourceDetailComplete === true && job.sourceDescription.length > 2000))
  assert.equal(jobs.find(job => job.jobId === '2313').postingDate, '2026-10-12')
  assert.equal(jobs.find(job => job.jobId === '2313').sourcePostingDate, '2026-10-12')
  assert.equal(jobs.find(job => job.jobId === '2313').sourceClosingDate, '2026-11-27')
  assert.equal(jobs.find(job => job.jobId === '2345').postingDate, '2026-10-01')
  assert.ok(jobs.every(job => job.sourceDateEvidence === 'aurigo-native-posting-dates-v1'))
  assert.ok(jobs.every(job => job.sourceDatePrecision === 'day'))
  assert.ok(jobs.every(job => job.sourceClosingDateIsExact === false))
  assert.ok(jobs.every(job => job.sourceListingComplete === false))
  for (const job of jobs.filter(job => job.jobId !== '1988')) {
    assert.equal(job.location, 'Bangalore, India')
    assert.equal(job.city, 'Bangalore')
    assert.deepEqual(job.locations, ['Bangalore, India'])
  }
  const countryOnly = jobs.find(job => job.jobId === '1988')
  assert.equal(countryOnly.location, 'India')
  assert.equal(countryOnly.city, null)
  assert.deepEqual(countryOnly.locations, ['India'])
  assert.equal(countryOnly.sourceLocationEvidence, 'aurigo-native-listing-country-only-v1')
})

test('Aurigo binds active native body to role, employer, canonical URL and explicit India evidence', () => {
  const role = roles.find(r => r.jobId === '2313'), response = page(role)
  assert.ok(aurigo.extractAurigoNativeDetail(role, response, role.nativeListingRecord)?.sourceDescription)
  for (const changed of [
    { ...response, status: 403 },
    { ...response, finalUrl: aurigo.AURIGO_ERROR_PAGE_URL },
    { ...response, html: response.html.replace('rel="canonical"', 'rel="alternate"') },
    { ...response, html: response.html.replaceAll('Aurigo Software Technologies', 'Other employer') },
    { ...response, html: response.html.replaceAll('Senior AI Developer', 'Unrelated role') },
    { ...response, html: response.html.replace('Bangalore, India', 'Austin, United States') },
    { ...response, html: response.html.replace('10/12/26', '2/31/26') },
    { ...response, html: '<template>' + response.html + '</template>' },
    { ...response, html: '<!--' + response.html + '-->' },
  ]) assert.equal(aurigo.extractAurigoNativeDetail(role, changed, role.nativeListingRecord), null)
  assert.equal(aurigo.extractAurigoNativeDetail({ ...role, jobId: '1988' }, response, role.nativeListingRecord), null)
  assert.equal(aurigo.extractAurigoNativeDetail(role, response, { ...role.nativeListingRecord, filter1: ['India', 'United States'] }), null)
  const blankLocation = roles.find(r => r.jobId === '1988')
  assert.equal(aurigo.extractAurigoNativeDetail(blankLocation, page(blankLocation)), null)
  assert.ok(aurigo.extractAurigoNativeDetail(blankLocation, page(blankLocation), blankLocation.nativeListingRecord)?.sourceDescription)
})

test('Aurigo native publication facts remain valid independently of an empty employer body', () => {
  const role = roles.find(r => r.jobId === '2313'), response = page(role)
  const empty = { ...response, html: response.html.replace(/(<span itemprop="description">)[\s\S]*?(<\/span>)/, '$1$2') }
  const detail = aurigo.extractAurigoNativeDetail(role, empty, role.nativeListingRecord)
  assert.equal(detail.sourceDescription, null)
  assert.equal(detail.sourceDetailComplete, false)
  assert.equal(detail.postingDate, '2026-10-12')
  assert.equal(detail.closingDate, '2026-11-27')
  assert.equal(detail.sourceDatePrecision, 'day')
  assert.equal(detail.sourceClosingDateIsExact, false)
})
