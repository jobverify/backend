import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { extractJobListings, extractJobDetail, createLennoxScraper, SEARCH_PAGE_URL, CAREERS_PAGE_URL } from './script.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture = name => gunzipSync(readFileSync(new URL('./fixtures/' + name + '-20261111.html.gz', import.meta.url))).toString('utf8')
const listing = fixture('india-listing')
const detail = fixture('cloud-solutions-detail')
const detailURL = 'https://indiacareers-lennox.icims.com/jobs/55653/cloud-solutions-developer-lead/job?in_iframe=1'
const role = { title: 'Cloud Solutions Developer Lead', jobId: '55653', requisitionId: '2026-55653',
  sourceUrl: detailURL, location: 'Chennai, India', city: 'Chennai', country: 'India',
  nativeLocationLabels: ['IN-Chennai'] }

test('current iCIMS job-card elements retain all fifteen explicitly located India records', () => {
  const rows = extractJobListings(listing)
  assert.equal(rows.length, 15)
  assert.deepEqual(rows.map(row => row.jobId), ['55657', '55656', '55653', '55608', '55595',
    '55040', '55010', '54836', '54799', '54790', '54502', '54252', '54248', '53776', '52021'])
  assert.equal(rows[2].title, 'Cloud Solutions Developer Lead')
  assert.equal(rows[2].country, 'India')
  assert.equal(rows[2].requisitionId, '2026-55653')
  assert.equal(rows[2].sourceUrl, detailURL)
})

test('current full detail binds title, native work country, employer and complete criteria', () => {
  const job = extractJobDetail(detail, role)
  assert.equal(job.country, 'India')
  assert.equal(job.city, 'Chennai')
  assert.equal(job.requisitionId, '2026-55653')
  assert.equal(job.company, 'Lennox International')
  assert.equal(job.nativeHiringOrganization.name, 'Lennox International')
  assert.equal(job.legalEmployer, null)
  assert.equal(job.sourceDetailComplete, true)
  assert.ok(job.sourceDescription.includes('Company Profile'))
  assert.ok(job.sourceDescription.includes('Job Description'))
  assert.ok(job.sourceDescription.includes('Qualifications'))
  assert.ok(job.sourceDescription.includes('MS in Computer Science/Computer Engineering or equivalent is preferred.'))
  assert.equal(job.postingDate, '2026-11-10T05:00:00.000Z')
  assert.equal(job.closingDate, '2027-11-10T05:00:00.000Z')
  assert.match(job.applyUrl, /\/55653\/cloud-solutions-developer-lead\/job\?mode=apply&apply=yes&in_iframe=1/)
})

const nativePosting = html => [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(match => JSON.parse(match[1])).find(record => record['@type'] === 'JobPosting')
const dataAnalyticsRole = { ...role, title: 'Manager – Data & Analytics - Operations', jobId: '55608',
  requisitionId: '2026-55608', sourceUrl: 'https://indiacareers-lennox.icims.com/jobs/55608/manager-%e2%80%93-data-%26-analytics---operations/job?in_iframe=1' }
const dataNetworkRole = { ...role, title: 'Lead Architect - Data Network', jobId: '52021',
  requisitionId: '2026-52021', sourceUrl: 'https://indiacareers-lennox.icims.com/jobs/52021/lead-architect---data-network/job?in_iframe=1' }

test('inline spans preserve punctuation adjacency in the captured data analytics criteria', () => {
  const html = fixture('data-analytics-detail')
  const job = extractJobDetail(html, dataAnalyticsRole)
  assert.equal(job.sourceDescription, nativePosting(html).description)
  assert.ok(job.nativeVisibleCriteria[1].text.includes('business and technology objectives.'))
  assert.equal(job.company, 'Lennox International')
  assert.equal(job.country, 'India')
  assert.equal(job.sourceScopeComplete, false)
  assert.equal(job.lifecycleCleanupAllowed, false)
})

test('inline spans do not invent sentence whitespace in the captured data network criteria', () => {
  const html = fixture('data-network-detail')
  const job = extractJobDetail(html, dataNetworkRole)
  assert.equal(job.sourceDescription, nativePosting(html).description)
  assert.ok(job.nativeVisibleCriteria[1].text.includes('network platforms.This role'))
  assert.equal(job.requisitionId, '2026-52021')
  assert.equal(job.sourceDetailComplete, true)
})

test('a visible punctuation change across inline spans still rejects the full criteria', () => {
  const html = fixture('data-analytics-detail')
  const changed = html.replace(/(objectives<\/span><span\b[^>]*>)\.(<\/span>)/, '$1!$2')
  assert.notEqual(changed, html, 'the mutation must change the captured visible punctuation')
  assert.throws(() => extractJobDetail(changed, dataAnalyticsRole), /full criteria mismatch/i)
})

test('real visible line breaks absent from the native refrigeration schema remain a mismatch', () => {
  const html = fixture('refrigeration-detail')
  assert.ok(html.includes('experience.<br /><br />Strong'))
  assert.ok(nativePosting(html).description.includes('experience.Strong'))
  const refrigerationRole = { ...role, title: 'Refrigeration Engineer', jobId: '54790',
    requisitionId: '2026-54790', sourceUrl: 'https://indiacareers-lennox.icims.com/jobs/54790/refrigeration-engineer/job?in_iframe=1' }
  assert.throws(() => extractJobDetail(html, refrigerationRole), /full criteria mismatch/i)
})

const schemaChange = change => detail.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/gi,
  (all, start, raw, end) => {
    const record = JSON.parse(raw)
    return record['@type'] === 'JobPosting' ? start + JSON.stringify(change(record)) + end : all
  })

for (const [name, change, message] of [
  ['different role title', record => ({ ...record, title: 'Unrelated role' }), /title/i],
  ['missing work country', record => ({ ...record, jobLocation: [{ address: { addressLocality: 'Chennai' } }] }), /country/i],
  ['contradictory work country', record => ({ ...record, jobLocation: [{ address: { addressCountry: 'US', addressLocality: 'Chennai' } }] }), /country/i],
  ['different native employer', record => ({ ...record, hiringOrganization: { name: 'Another Company' } }), /employer/i],
  ['schema-only criteria', record => ({ ...record, description: '<p>Develop entirely different software applications and deploy unrelated services for another engineering team. Maintain different production systems and perform other responsibilities.</p>' }), /criteria|description/i],
]) test('a current detail rejects ' + name, () => {
  assert.throws(() => extractJobDetail(schemaChange(change), role), message)
})

test('inert job cards cannot become active vacancies', () => {
  assert.deepEqual(extractJobListings('<template>' + listing + '</template>'), [])
})

const globalListing = fixture('global-listing')
const corporate = fixture('corporate-careers')
const indiaURL = 'https://globalcareers-lennox.icims.com/jobs/search?in_iframe=1&hashed=-435743357&ss=1&searchLocation=13228--Chennai'
const response = (url, html, status = 200) => {
  const value = new Response(html, { status, headers: { 'content-type': 'text/html;charset=UTF-8' } })
  Object.defineProperty(value, 'url', { value: url })
  return value
}
function publisherTransport(t, { india = listing, employer = corporate, closingIndia, status = 200 } = {}) {
  let reads = 0
  t.mock.method(globalThis, 'fetch', async value => {
    const url = String(value)
    if (url === CAREERS_PAGE_URL) return response(url, employer)
    if (url === SEARCH_PAGE_URL) return response(url, globalListing)
    if (url === indiaURL) return response(url, ++reads > 1 && closingIndia != null ? closingIndia : india, status)
    if (url === detailURL) return response(url, detail)
    return response(url, '<h1>Unavailable</h1>', 503)
  })
}

test('registered native run follows the current corporate declaration and India form, retaining qualified details and omitted-detail caveats', async t => {
  publisherTransport(t)
  const jobs = await createLennoxScraper().run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '55653')
  assert.equal(jobs[0].company, 'Lennox International')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readSourceObservationEvidence(jobs, 'lennox').observedVacancyCount, 15)
  assert.equal(jobs.nativeCollectionEvidence.failures.length, 14)
  assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete, false)
  assert.ok(jobs.nativeCollectionEvidence.retainedResponses.every(packet => /^[a-f0-9]{64}$/.test(packet.bodySHA256)))
})

test('a current empty India response stays a coverage gap', async t => {
  publisherTransport(t, { india: '<title>LII Careers</title><p>No jobs found.</p>' })
  const jobs = await createLennoxScraper().run()
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('a changed closing native inventory cannot certify opening role details', async t => {
  publisherTransport(t, { closingIndia: listing.replace(/(<h3[^>]*>\s*)Cloud Solutions Developer Lead(\s*<\/h3>)/,
    '$1Different Closing Title$2') })
  await assert.rejects(createLennoxScraper().run(), /closing.*inventory|inventory.*changed/i)
})

test('a quoted corporate ATS link cannot supply current publisher authority', async t => {
  publisherTransport(t, { employer: corporate.replace('href="https://globalcareers-lennox.icims.com/"', 'href="https://unrelated.example/"')
    + '<template><a href="https://globalcareers-lennox.icims.com/">Explore All Lennox Career Opportunities</a></template>' })
  await assert.rejects(createLennoxScraper().run(), /corporate.*declaration|declaration.*missing/i)
})
