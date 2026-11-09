import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import * as citi from '../../../scraper/citiindia/script.js'
import { normalizeScrapedJob } from '../../utils/normalizeScrapedJob.js'
import { isIndiaJob } from '../../utils/indiaLocationFilter.js'

globalThis.fetch = async () => { throw Error('Pure parser controls prohibit network and website code execution') }
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/actual-http-20261031.json.gz', import.meta.url))))
const pages = new Map(fixture.entities.map(page => [page.receipt.url, page]))
const original = url => Buffer.from(pages.get(url).bodyBase64, 'base64').toString('utf8')
const first = fixture.citiOracle[0], input = { sourceUrl: first.url, jobId: first.sourceTBID }
const posting = (body, change) => body.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/gi,
  (whole, begin, raw, end) => { const model = JSON.parse(raw);return model['@type'] === 'JobPosting' ? begin + JSON.stringify(change(model)) + end : whole })
const ownLocation = (body, label) => body.replace(/(<div class="job-description__desc-job-info job-location">[\s\S]*?<p class="job-description__desc-detail">)[\s\S]*?(<\/p>)/, '$1' + label + '$2')
const publicModel = job => normalizeScrapedJob(job, { source: 'citiindia', companyName: 'Citi India', countryFilter: 'India' })

test('genuine place representations project one owned visible location while retaining typed raw region/code', () => {
  const job = citi.extractJobDetail(original(first.url), input)
  assert.deepEqual(job.locations, ['Bengaluru, Karnataka, India'])
  assert.equal(job.sourceNativeJobPosting.jobLocation[0].address.addressRegion, 'KA')
})

test('genuine current pagination request42 matches the original native GET; old malformed href is not followed', () => {
  const expected = fixture.entities.find(page => page.receipt.purpose === 'opening-declared-GET-pagination' && page.receipt.declaration.page === 42)
  assert.equal(citi.buildSearchUrl({ page: 42, primaryHTML: original(citi.CAREER_PAGE_URL) }), expected.receipt.url)
  assert.throws(() => citi.buildSearchUrl({ page: 2 }), /current native primary HTML/i)
})

for (const label of ['Pune', 'Pune, IN', 'Multiple locations']) test('artificial city/region/search context cannot become a role country: ' + label, () => {
  const body = ownLocation(posting(original(first.url), model => { delete model.jobLocation;return model }), label)
  const job = citi.extractJobDetail(body, input)
  assert.equal(job.sourceNativeVisibleLocationLabel, label)
  assert.equal(job.country, null);assert.equal(job.city, null);assert.equal(job.location, null);assert.deepEqual(job.locations, [])
  assert.equal(job.sourceCountryScopeUnresolved, true);assert.equal(isIndiaJob(publicModel(job)), false)
})

test('artificial same-place visible country contradiction holds the public projection', () => {
  const job = citi.extractJobDetail(ownLocation(original(first.url), 'Bengaluru, Karnataka, USA'), input)
  assert.equal(job.sourceNativeCountryConflict, true);assert.equal(job.country, null)
  assert.equal(isIndiaJob(publicModel(job)), false)
  assert.equal(job.sourceNativeJobPosting.jobLocation[0].address.addressCountry, 'IN')
})

test('artificial identical typed worksite with conflicting countries is held even when the owned label agrees with one', () => {
  const body = posting(original(first.url), model => {
    model.jobLocation.push({ ...structuredClone(model.jobLocation[0]), address: { ...model.jobLocation[0].address, addressCountry: 'US' } })
    return model
  })
  const job = citi.extractJobDetail(body, input)
  assert.equal(job.sourceNativeCountryConflict, true)
  assert.equal(job.country, null);assert.equal(isIndiaJob(publicModel(job)), false)
  assert.equal(job.sourceNativeJobPosting.jobLocation.length, 2)
})

test('artificial repeated visible worksite with conflicting countries is held without a typed fallback', () => {
  const body = ownLocation(posting(original(first.url), model => { delete model.jobLocation;return model }),
    'Bengaluru, Karnataka, India, Bengaluru, Karnataka, USA')
  const job = citi.extractJobDetail(body, input)
  assert.equal(job.sourceNativeCountryConflict, true)
  assert.equal(job.country, null);assert.equal(isIndiaJob(publicModel(job)), false)
})

test('artificial same-named cities in explicitly distinct states retain separate coherent country worksites', () => {
  const body = ownLocation(posting(original(first.url), model => {
    model.jobLocation = [
      { '@type': 'Place', address: { addressLocality: 'Springfield', addressRegion: 'Karnataka', addressCountry: 'IN' } },
      { '@type': 'Place', address: { addressLocality: 'Springfield', addressRegion: 'Illinois', addressCountry: 'US' } },
      { '@type': 'Place', address: { addressLocality: 'Undeclared site' } },
    ];return model
  }), 'Springfield, Karnataka, India, Springfield, Illinois, USA')
  const job = citi.extractJobDetail(body, input)
  assert.equal(job.sourceNativeCountryConflict, false);assert.equal(job.country, 'India')
  assert.equal(job.sourceCountryScopeUnresolved, true);assert.equal(isIndiaJob(publicModel(job)), true)
  assert.deepEqual(job.locations, ['Springfield, Karnataka, India'])
  assert.equal(job.sourceNativeOriginalJobLocations.length, 3)
})

test('artificial coherent foreign primary and separately typed India worksite preserve proven India scope', () => {
  const body = ownLocation(posting(original(first.url), model => {
    model.jobLocation.push({ '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: 'New York', addressRegion: 'New York', addressCountry: 'US' } })
    return model
  }), 'New York, New York, USA')
  const job = citi.extractJobDetail(body, input)
  assert.equal(job.country, 'India');assert.equal(job.sourceNativeCountryConflict, false)
  assert.equal(isIndiaJob(publicModel(job)), true)
  assert.ok(job.sourceNativeCountryCodes.includes('United States'))
})

test('genuine empty Time Type does not borrow the following skill heading or acquire Full-time', () => {
  const expected = fixture.citiOracle.find(value => !value.sourceTimeTypeValues.length && !/full[\s-]*time/i.test(value.ownTitle))
  const job = citi.extractJobDetail(original(expected.url), { sourceUrl: expected.url, jobId: expected.sourceTBID })
  assert.equal(job.sourceEmploymentType, null);assert.equal(job.sourceEmploymentTypeUnresolved, true)
  assert.notEqual(publicModel(job).employmentType, 'Full-time')
})

test('artificial literal Part time survives while the existing consumer cannot default it to Full-time', () => {
  const body = original(first.url).replaceAll('Full time', 'Part time')
  assert.notEqual(body, original(first.url), 'Control must change the genuine owned hours field')
  const job = citi.extractJobDetail(body, input), normalized = publicModel(job)
  assert.equal(job.sourceEmploymentType, 'Part time')
  assert.equal(normalized.sourceEmploymentType, 'Part time');assert.equal(normalized.employmentType, null)
})

test('genuine absent arrangement stays unknown despite a physical India worksite', () => {
  const expected = fixture.citiOracle.find(value => !value.ownFields['Job Type:'])
  const job = citi.extractJobDetail(original(expected.url), { sourceUrl: expected.url, jobId: expected.sourceTBID })
  assert.equal(job.remoteStatus, null);assert.equal(publicModel(job).remoteStatus, null)
})

test('artificial invalid day remains raw and does not become a fabricated source timestamp', () => {
  const job = citi.extractJobDetail(posting(original(first.url), model => { model.datePosted = '2026-02-30';return model }), input)
  assert.equal(job.sourcePostingDate, '2026-02-30');assert.equal(job.postingDate, null)
})

test('artificial duplicate decoded source key is rejected instead of last-wins', () => {
  const body = original(first.url).replace(/("hiringOrganization"\s*:)/, '"hiringOrganization":{},$1')
  assert.throws(() => citi.extractJobDetail(body, input), /missing, duplicate or unreadable/i)
})

test('artificial native company, requisition and own-title conflicts do not borrow unrelated headings', () => {
  assert.throws(() => citi.extractJobDetail(posting(original(first.url), model => { model.hiringOrganization.name = 'Other Employer';return model }), input), /employer conflict/)
  assert.throws(() => citi.extractJobDetail(posting(original(first.url), model => { model.identifier.value = 'OTHER';return model }), input), /requisition.*conflict/)
  const unrelated = '<h1 class="job-title-heading">Business Analytics Analyst</h1>'
  const changed = original(first.url).replace(/(<h1 class="job-title-heading">)[\s\S]*?(<\/h1>)/, '$1Different role$2').replace('</body>', unrelated + '</body>')
  assert.throws(() => citi.extractJobDetail(changed, input), /title\/employer conflict/)
})

test('artificial quoted JobPosting examples remain terminal data and encoded brackets survive', () => {
  const body = posting(original(first.url), model => {
    model.example = '{"@type":"JobPosting","hiringOrganization":{"name":"Other Employer"}}'
    model.description += '<p>Use &lt;T&gt; &amp; parse this literal example without executing it.</p>'
    return model
  })
  const job = citi.extractJobDetail(body, input)
  assert.ok(job.jobDescription.includes('Use <T> & parse this literal example without executing it.'))
  assert.equal(job.country, 'India')
})

test('explicit finite page caps are rejected before requests rather than silently ignored or called complete', async () => {
  let calls = 0
  await assert.rejects(citi.createCitiIndiaScraper({ maxPages: 1 }).run({ fetchPage: async () => { calls++;throw Error('No request allowed') } }), /finite maxPages/i)
  assert.equal(calls, 0)
})

test('artificial access-denied native asset stops that host for this run without repeat attempts', async () => {
  const target = 'https://tbcdn.talentbrew.com/js/client/search.js', calls = []
  const jobs = await citi.run({ fetchPage: async url => {
    calls.push(url);const page = pages.get(url);assert.ok(page)
    return { url, status: url === target ? 403 : page.receipt.status,
      headers: page.receipt.headers || page.receipt.responseHeaders, bodyBase64: page.bodyBase64 }
  } })
  assert.equal(calls.filter(url => url === target).length, 1)
  assert.equal(jobs.length, 0)
})
