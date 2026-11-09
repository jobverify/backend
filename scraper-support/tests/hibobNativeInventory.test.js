import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHiBobNativeInventory } from '../hibob/nativeInventory.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const fixture = name => gunzipSync(readFileSync(new URL('./fixtures/hibob-current-20261026/' + name + '.gz', import.meta.url))).toString()
const configs = Object.fromEntries(['sapiens', 'snowplow'].map(source => [source, {
  source, company: source === 'sapiens' ? 'Sapiens' : 'Snowplow', domain: source === 'sapiens' ? 'sapiens.com' : 'snowplow.io',
  careers: source === 'sapiens' ? 'https://sapiens.com/careers/' : 'https://snowplow.io/careers', board: `https://${source}.careers.hibob.com/`,
  redirectHandoff: source === 'sapiens',
}]))
const sections = ['description', 'responsibilities', 'requirements', 'benefits']
// Additional form responses in unit tests are synthetic projections of the
// captured feed into the separately captured current public-form schema.
const formFor = row => ({ data: { jobAd: { type: 'api', title: row.title, site: `${row.site}, ${row.country}`,
  employmentType: row.employmentType, workspaceType: row.workspaceType, languageCode: row.language,
  applicationForm: { id: 123, '/applicationForm/questions': { value: [] }, '/applicationForm/documents': { value: [] }, '/applicationForm/fields': { value: [] } },
  jobDescription: Object.fromEntries([...sections.filter(k => row[k]).map(k => [`/jobAd/descriptionId./jobDescription/${k}`, { value: row[k] }]),
    ['/jobAd/descriptionId./jobDescription/sectionLabels', { value: row.sectionLabels }]]),
} } })
const run = async ({ source = 'sapiens', mutate = () => {}, maxJobs = 0, signal } = {}) => {
  const config = configs[source], feed = JSON.parse(fixture(source + '-job-ad.json')), site = JSON.parse(fixture(source + '-career-site.json'))
  const calls = [], counts = new Map(), forms = new Map(feed.jobAdDetails.filter(row => row.country === 'India').map(row => [row.id, formFor(row)]))
  const first = feed.jobAdDetails[0]
  if (source === 'sapiens') forms.set(first.id, JSON.parse(fixture('sapiens-first-form.json')))
  if (source === 'sapiens') forms.set('0560aaa0-28ad-4082-85e4-e5b55f20eaf1', JSON.parse(fixture('sapiens-additional-form.json')))
  const fetchPage = async (url, init) => {
    calls.push(url); assert.equal(init.method, 'GET')
    assert.equal(init.signal.aborted, false)
    const occurrence = (counts.get(url) || 0) + 1; counts.set(url, occurrence)
    let response = { status: 200, url, contentType: 'application/json', body: '' }
    if (url === config.careers) response = { ...response, contentType: 'text/html', url: config.redirectHandoff ? config.board : url, body: fixture(source + '-careers.html') }
    else if (url === config.board) response = { ...response, contentType: 'text/html', body: fixture('sapiens-careers.html') }
    else {
      assert.equal(init.headers.companyIdentifier, source)
      if (url === config.board + 'api/career-site') response.body = JSON.stringify(site)
      else if (url === config.board + 'api/job-ad') response.body = JSON.stringify(feed)
      else {
        const id = url.match(/\/api\/job-ad\/([^/]+)\/application-form$/)?.[1]
        assert.ok(forms.has(id), 'only public India form definitions are requested')
        response.body = JSON.stringify(forms.get(id))
      }
    }
    mutate({ url, occurrence, response, feed, forms, config, calls })
    return response
  }
  const jobs = await createHiBobNativeInventory(config).run({ fetchPage, maxJobs, signal, now: () => '2026-10-26T20:00:00.000Z' })
  return { jobs, evidence: readInventoryEvidence(jobs), calls }
}
test('current Sapiens migration recovers all 16 typed India roles with complete sections, dates and public application identity', async () => {
  const { jobs, evidence, calls } = await run()
  assert.equal(jobs.length, 16); assert.equal(evidence.listingComplete, true); assert.equal(evidence.reportedTotal, 56); assert.equal(evidence.indiaFacetCount, 16)
  assert.equal(jobs[0].postingDate, '2026-10-26T07:59:11.166Z'); assert.equal(jobs[0].sourceNativeDates.publishedAt, '2026-10-26T07:59:11.166650446Z')
  assert.equal(jobs[0].requisitionId, null); assert.equal(jobs[0].city, null); assert.equal(jobs[0].country, 'India')
  assert.match(jobs[0].jobDescription, /Azure Fundamental/); assert.match(jobs[0].applyUrl, /\/jobs\/[a-f0-9-]+\/apply$/)
  assert.equal(calls.length, 40); assert.ok(jobs.every(row => row.sourceDetailComplete && row.sourceListingComplete))
  assert.match(jobs.find(row => row.jobId === '0560aaa0-28ad-4082-85e4-e5b55f20eaf1').jobDescription, /Pervasive \/ Actian database/)
})
test('Snowplow public company routing reads five known foreign roles without inventing an India vacancy', async () => {
  const { jobs, evidence } = await run({ source: 'snowplow' })
  assert.equal(jobs.length, 0); assert.equal(evidence.status, 'complete-inventory'); assert.equal(evidence.reportedTotal, 5); assert.equal(evidence.indiaFacetCount, 0)
})
for (const [label, mutate] of [
  ['unknown country', c => { const p = JSON.parse(c.response.body); p.jobAdDetails[0].country = 'Unknown'; c.response.body = JSON.stringify(p) }],
  ['conflicting typed site country', c => { const p = JSON.parse(c.response.body); p.jobAdDetails[0].site = 'Canada'; c.response.body = JSON.stringify(p) }],
  ['additional pagination', c => { const p = JSON.parse(c.response.body); p.nextCursor = 'next-page'; c.response.body = JSON.stringify(p) }],
  ['missing full native description', c => { const p = JSON.parse(c.response.body); p.jobAdDetails[0].description = ''; c.response.body = JSON.stringify(p) }],
  ['hidden native description', c => { const p = JSON.parse(c.response.body); p.jobAdDetails[0].description = '<div hidden>' + p.jobAdDetails[0].description + '</div>'; c.response.body = JSON.stringify(p) }],
  ['orphan native department', c => { const p = JSON.parse(c.response.body); p.jobAdDetails[0].departmentId = 'unknown'; c.response.body = JSON.stringify(p) }],
  ['expired native role', c => { const p = JSON.parse(c.response.body); p.jobAdDetails[0].validThrough = '2025-01-01T00:00:00Z'; c.response.body = JSON.stringify(p) }],
  ['global remote country scope', c => { const p = JSON.parse(c.response.body); p.jobAdDetails[0].country = 'Worldwide'; c.response.body = JSON.stringify(p) }],
]) test(label + ' keeps inventory incomplete', async () => {
  const result = await run({ mutate: c => { if (c.url.endsWith('/api/job-ad')) mutate(c) } })
  assert.equal(result.evidence.listingComplete, false); assert.equal(result.evidence.indiaFacetCount, null)
})
for (const [label, replacement] of [
  ['foreign native form site', j => { j.site = 'Toronto, Canada' }],
  ['different native form title', j => { j.title = 'Different role' }],
  ['native form body mismatch', j => { j.jobDescription['/jobAd/descriptionId./jobDescription/description'].value = '<p>Different real full role narrative</p>' }],
  ['missing public application definition', j => { delete j.applicationForm }],
]) test(label + ' prevents a complete role record', async () => {
  const { jobs, evidence } = await run({ mutate: c => { if (c.url.includes('/ca3cec2e-') && c.url.endsWith('/application-form')) { const p = JSON.parse(c.response.body); replacement(p.data.jobAd); c.response.body = JSON.stringify(p) } } })
  assert.equal(evidence.listingComplete, false); assert.ok(!jobs.some(row => row.jobId === 'ca3cec2e-bb5d-4619-a9c1-b1a19ee8fafd'))
})
test('closing-only publication or body changes remain incomplete and exclude the changed role', async () => {
  const { jobs, evidence } = await run({ mutate: c => { if (c.url.endsWith('/api/job-ad') && c.occurrence === 2) { const p = JSON.parse(c.response.body); p.jobAdDetails[0].publishedAt = '2026-10-25T01:00:00Z'; c.response.body = JSON.stringify(p) } } })
  assert.equal(evidence.listingComplete, false); assert.equal(jobs.length, 15)
})
for (const where of ['opening', 'closing']) test('additional ' + where + ' first-party ATS scope prevents foreign-only absence proof', async () => {
  const { evidence } = await run({ source: 'snowplow', mutate: c => { if (c.url === c.config.careers && (where === 'opening' || c.occurrence === 2)) c.response.body += '<a href="https://example.wd1.myworkdayjobs.com/careers">Additional jobs</a>' } })
  assert.equal(evidence.listingComplete, false)
})
test('inert ATS links do not create an active additional scope', async () => {
  const { evidence } = await run({ source: 'snowplow', mutate: c => { if (c.url === c.config.careers) c.response.body += '<template><a href="https://example.wd1.myworkdayjobs.com/careers">Additional jobs</a></template>' } })
  assert.equal(evidence.listingComplete, true)
})
test('another employer tenant or changed company binding fails closed', async () => {
  await assert.rejects(run({ mutate: c => { if (c.url.endsWith('/api/career-site')) { const p = JSON.parse(c.response.body); p.companyName = 'Other employer'; c.response.body = JSON.stringify(p) } } }), /employer/i)
})
test('caps apply only after complete closing reconciliation and retain incomplete scope', async () => {
  const { jobs, evidence, calls } = await run({ maxJobs: 1 }); assert.equal(jobs.length, 1); assert.equal(calls.length, 40); assert.equal(evidence.listingComplete, false); assert.match(evidence.reason, /source-job-limit/)
})
test('a denied public feed stops immediately without trying alternate routes', async () => {
  const calls = []
  await assert.rejects(run({ mutate: c => { calls.push(c.url); if (c.url.endsWith('/api/job-ad')) c.response.status = 403 } }), /403/)
  assert.equal(calls.filter(url => url.endsWith('/api/job-ad')).length, 1); assert.ok(!calls.some(url => url.endsWith('/application-form')))
})
test('cancellation prevents any public request', async () => { const controller = new AbortController(); controller.abort(); await assert.rejects(run({ signal: controller.signal }), { name: 'AbortError' }) })
test('closing-only public application form changes retain partial scope', async () => {
  const { jobs, evidence } = await run({ mutate: c => { if (c.url.includes('/ca3cec2e-') && c.occurrence === 2) { const p = JSON.parse(c.response.body); p.data.jobAd.applicationForm.id++; c.response.body = JSON.stringify(p) } } })
  assert.equal(jobs.length, 15); assert.equal(evidence.listingComplete, false); assert.match(evidence.reason, /closing-native-application-changed/)
})
for (const addition of [
  '<iframe src="https://jobs.ashbyhq.com/snowplow"></iframe>',
  '<a href="https://snowplow.careers.hibob.com/jobs/11111111-1111-4111-8111-111111111111/overview">India Engineer</a>',
  '<script>window.jobs="https:\\/\\/jobs.ashbyhq.com\\/snowplow"</script>',
]) test('advertised additional frame, native posting or script keeps foreign-only inventory partial: ' + addition.slice(0, 35), async () => {
  const { evidence } = await run({ source: 'snowplow', mutate: c => { if (c.url === c.config.careers && c.occurrence === 2) c.response.body += addition } })
  assert.equal(evidence.listingComplete, false)
})
test('configured Sapiens migration requires the observed first-party redirect', async () => {
  await assert.rejects(run({ mutate: c => { if (c.url === c.config.careers) c.response.url = c.url } }), /redirect|handoff/i)
})
test('object-valued continuation metadata cannot certify a whole public feed', async () => {
  const { evidence } = await run({ mutate: c => { if (c.url.endsWith('/api/job-ad')) { const p = JSON.parse(c.response.body); p.jobOpeningMetadata = { nextCursor: 'next-page', total: 100 }; c.response.body = JSON.stringify(p) } } })
  assert.equal(evidence.listingComplete, false)
})
test('new typed role identity fields on the application document are not ignored', async () => {
  const { jobs, evidence } = await run({ mutate: c => { if (c.url.includes('/ca3cec2e-')) { const p = JSON.parse(c.response.body); p.data.jobAd.country = 'Canada'; c.response.body = JSON.stringify(p) } } })
  assert.equal(jobs.length, 15); assert.equal(evidence.listingComplete, false)
})
test('native career configuration additional ATS redirect is unresolved scope', async () => {
  const { evidence } = await run({ source: 'snowplow', mutate: c => { if (c.url.endsWith('/api/career-site')) { const p = JSON.parse(c.response.body); p.sections[0].data.redirectUrl = 'https://jobs.ashbyhq.com/snowplow'; c.response.body = JSON.stringify(p) } } })
  assert.equal(evidence.listingComplete, false)
})
for (const addition of [
  '<iframe srcdoc="&lt;a href=&quot;https://jobs.ashbyhq.com/snowplow&quot;&gt;Careers&lt;/a&gt;"></iframe>',
  '<a href="https://snowplow.careers-page.com/">Careers</a>',
  '<a href="https://hiring.snowplow.example/new-board">Current openings</a>',
]) test('additional embedded or unfamiliar hiring surface retains partial scope: ' + addition.slice(0, 40), async () => {
  const { evidence } = await run({ source: 'snowplow', mutate: c => { if (c.url === c.config.careers) c.response.body += addition } })
  assert.equal(evidence.listingComplete, false)
})
