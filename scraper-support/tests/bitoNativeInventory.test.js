import test from 'node:test'
import assert from 'node:assert/strict'
import { gunzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { createBitoNativeInventory } from '../../scraper/bito/nativeInventory.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
const C = 'https://bito.ai/careers/', B = 'https://bito.freshteam.com', F = B + '/hire/widgets/jobs.json'
const W = 'https://s3.amazonaws.com/files.freshteam.com/production/98462/attachments/6016898292/original/6000034511_widget.js?1733908707'
const J = 'https://assets1.freshteam.com/assets/job_widget.js', D = B + '/jobs/Ot1OTp378jzF/account-executive-new-business-san-francisco-bay-area'
const D2 = B + '/jobs/NewIndiaPosting/second-india-role'
const fixture = name => gunzipSync(readFileSync(new URL('../../scraper/bito/fixtures/native-20261026/' + name + '.gz', import.meta.url))).toString()
const originals = new Map([[C, ['careers.html', 'text/html']], [W, ['widget-bootstrap.js', 'text/plain']], [J, ['widget-client.js', 'application/javascript']],
  [F, ['jobs.json', 'application/json']], [B + '/jobs', ['board.html', 'text/html']], [D, ['detail.html', 'text/html']]])
const positiveIndia = c => {
  const usa = 'San Francisco, United States of America | New York, United States of America'
  if (c.url === F) { const p = JSON.parse(c.response.body); for (const row of p.jobs) row.preferred_remote_job_locations = 'Pune, India'; c.response.body = JSON.stringify(p) }
  if ([D, D2].includes(c.url)) c.response.body = c.response.body.replaceAll(usa, 'Pune, India')
}
const run = async ({ india = false, mutate = () => {}, maxJobs = 0, signal, extraRole = false } = {}) => {
  const calls = [], counts = new Map(); let audit
  const jobs = await createBitoNativeInventory().run({ now: () => '2026-10-26T20:00:00Z', maxJobs, signal, requestIntervalMs: 0,
    fetchText: () => { throw Error('legacy network transport must not be used') },
    fetchPage: async (url, init) => {
      calls.push(url); assert.equal(init.method, 'GET'); assert.ok(originals.has(url) || extraRole && url === D2); assert.equal(init.signal.aborted, false)
      const [name, contentType] = originals.get(url) || ['detail.html', 'text/html'], occurrence = (counts.get(url) || 0) + 1; counts.set(url, occurrence)
      const c = { url, occurrence, response: { url, status: 200, contentType, body: fixture(name) }, calls }
      if (extraRole && url === F) { const p = JSON.parse(c.response.body); p.jobs.push({ ...p.jobs[0], id: p.jobs[0].id + 1, title: 'Second India Role', unique_id: 'NewIndiaPosting', url: C + '?jobId=NewIndiaPosting' }); c.response.body = JSON.stringify(p) }
      if (extraRole && url === B + '/jobs') {
        const anchor = c.response.body.match(/<a\b[^>]*href="\/jobs\/Ot1OTp378jzF\/[^\"]+"[^>]*>[\s\S]*?<\/a>/)[0]
        c.response.body = c.response.body.replace(anchor, anchor + '<a href="/jobs/NewIndiaPosting/second-india-role"><div class="job-title">Second India Role</div></a>')
      }
      if (url === D2) c.response.body = c.response.body.replaceAll('Ot1OTp378jzF', 'NewIndiaPosting').replaceAll('Account Executive, New Business (San Francisco Bay Area)', 'Second India Role').replaceAll('account-executive-new-business-san-francisco-bay-area', 'second-india-role')
      if (india) positiveIndia(c)
      mutate(c); return c.response
    }, onAudit: value => { audit = value },
  })
  return { jobs, evidence: readInventoryEvidence(jobs), calls, audit }
}
test('current Bito widget reads the advertised native feed and complete role but retains conflicting India office and US work scope', async () => {
  const { jobs, evidence, calls, audit } = await run()
  assert.equal(jobs.length, 0); assert.equal(evidence.status, 'discovery-only'); assert.equal(evidence.indiaFacetCount, null)
  assert.match(evidence.reason, /country-conflict/); assert.equal(calls.length, 12)
  assert.equal(audit.nativeTotal, 1); assert.equal(audit.roleDocuments[0].fullDescription, true)
  assert.deepEqual(audit.roleDocuments[0].workCountries, ['US']); assert.deepEqual(audit.roleDocuments[0].structuredCountries, ['IN'])
})
test('synthetic agreeing India work scope retains complete role content, actual publication and no invented requisition', async () => {
  const { jobs, evidence } = await run({ india: true })
  assert.equal(evidence.listingComplete, true, evidence.reason); assert.equal(evidence.reportedTotal, 1); assert.equal(jobs.length, 1)
  const job = jobs[0]; assert.equal(job.requisitionId, null); assert.equal(job.city, 'Pune'); assert.equal(job.country, 'India')
  assert.equal(job.postingDate, '2026-09-11T13:38:38.000Z'); assert.notEqual(job.postingDate, job.sourceNativeDates.createdAt)
  assert.match(job.jobDescription, /Key Responsibilities/); assert.match(job.jobDescription, /Qualifications/)
  assert.equal(job.sourceUrl, D); assert.equal(job.applyUrl, D + '#applicant-form'); assert.equal(job.sourceDetailComplete, true)
})
for (const [label, mutate] of [
  ['unknown native preferred country', c => { if (c.url === F) { const p = JSON.parse(c.response.body); p.jobs[0].preferred_remote_job_locations = 'Remote, Unknown'; c.response.body = JSON.stringify(p) } }],
  ['unsupported continuation', c => { if (c.url === F) { const p = JSON.parse(c.response.body); p.next_page = 2; c.response.body = JSON.stringify(p) } }],
  ['unlisted native role link', c => { if (c.url === B + '/jobs') c.response.body += '<a href="/jobs/new-native-id/india-role">India Engineer</a>' }],
  ['missing complete native content', c => { if (c.url === F) { const p = JSON.parse(c.response.body); p.jobs[0].description = ''; c.response.body = JSON.stringify(p) } }],
  ['hidden full native content', c => { if (c.url === F) { const p = JSON.parse(c.response.body); p.jobs[0].description = '<div hidden>' + p.jobs[0].description + '</div>'; c.response.body = JSON.stringify(p) } }],
  ['native expired job', c => { if (c.url === F) { const p = JSON.parse(c.response.body); p.jobs[0].closing_date = '2025-01-01T00:00:00Z'; c.response.body = JSON.stringify(p) } }],
  ['different native employer', c => { if (c.url === D) { const before = c.response.body; c.response.body = before.replace(/("name"\s*:\s*)"Bito"/g, '$1"Other employer"'); assert.notEqual(c.response.body, before) } }],
  ['additional active ATS', c => { if (c.url === C) c.response.body += '<a href="https://other.careers-page.com/">Current jobs</a>' }],
  ['additional active frame', c => { if (c.url === C) c.response.body += '<iframe src="https://jobs.ashbyhq.com/bito"></iframe>' }],
  ['changed lazy loading client', c => { if (c.url === C) c.response.body = c.response.body.replace('this.v="2.0.5"', 'this.v="2.0.6"') }],
]) test(label + ' cannot certify a complete inventory', async () => {
  const { evidence } = await run({ india: true, mutate }); assert.equal(evidence.listingComplete, false); assert.equal(evidence.indiaFacetCount, null)
})
test('native title or description changes appearing at closing exclude the affected role', async () => {
  const { jobs, evidence } = await run({ india: true, mutate: c => { if (c.url === F && c.occurrence === 2) { const p = JSON.parse(c.response.body); p.jobs[0].title = 'Changed India role'; c.response.body = JSON.stringify(p) } } })
  assert.equal(jobs.length, 0); assert.equal(evidence.listingComplete, false)
})
test('an output cap does not bypass native closing reads', async () => {
  const { calls } = await run({ india: true, maxJobs: 1 }); assert.equal(calls.length, 12)
})
test('first public denial stops without alternate routes or application requests', async () => {
  const calls = []
  await assert.rejects(run({ mutate: c => { calls.push(c.url); if (c.url === F) c.response.status = 403 } }), /403/)
  assert.equal(calls.at(-1), F); assert.ok(!calls.includes(D))
})
test('cancelled extraction makes no request', async () => { const controller = new AbortController(); controller.abort(); await assert.rejects(run({ signal: controller.signal }), { name: 'AbortError' }) })
for (const [label, mutate] of [
  ['new typed country field', c => { if (c.url === F) { const p = JSON.parse(c.response.body); p.jobs[0].country = 'Canada'; c.response.body = JSON.stringify(p) } }],
  ['structured employment conflict', c => { if (c.url === D) { const before = c.response.body; c.response.body = before.replace(/("employmentType"\s*:\s*)"FULL_TIME"/g, '$1"CONTRACT"'); assert.notEqual(c.response.body, before) } }],
  ['additional active inline hiring script', c => { if (c.url === C) c.response.body += '<script>window.jobs="https://jobs.ashbyhq.com/bito"</script>' }],
  ['unfamiliar labeled hiring link', c => { if (c.url === C) c.response.body += '<a href="https://hiring.example/bito">Current openings</a>' }],
]) test(label + ' retains unresolved inventory', async () => { const { evidence } = await run({ india: true, mutate }); assert.equal(evidence.listingComplete, false) })
for (const [label, mutate] of [
  ['invisible native publisher', c => { if (c.url === C) c.response.body = c.response.body.replace("id='freshteam-widget'", "id='freshteam-widget' style='opacity:0'") }],
  ['invisible full detail body', c => { if (c.url === D) c.response.body = c.response.body.replace('class="job-details-content content"', 'class="job-details-content content" style="opacity:0"') }],
  ['closing stylesheet hides the role body', c => { if (c.url === D && c.occurrence === 2) c.response.body += '<style>.job-details-content{display:none}</style>' }],
  ['closing visible role closure', c => { if (c.url === D && c.occurrence === 2) c.response.body = c.response.body.replace('<h1', '<p>This job is no longer accepting applications.</p><h1') }],
  ['contradictory top-level native country', c => { if (c.url === F) { const p = JSON.parse(c.response.body); p.jobs[0].country = 'Canada'; c.response.body = JSON.stringify(p) } }],
  ['unknown custom country scope', c => { if (c.url === F) { const p = JSON.parse(c.response.body); p.jobs[0].custom_field_attributes = { country: 'Canada' }; c.response.body = JSON.stringify(p) } }],
]) test(label + ' excludes the uncertain India role', async () => { const { jobs, evidence } = await run({ india: true, mutate }); assert.equal(jobs.length, 0); assert.equal(evidence.listingComplete, false) })
for (const addition of ['<a href="https://bito.ai/internships/">Current internships and jobs</a>', '<a href="https://jobs.smartrecruiters.com/Bito">Apply now</a>']) test('additional hiring route remains unresolved: ' + addition.slice(0, 50), async () => {
  const { evidence } = await run({ india: true, mutate: c => { if (c.url === C) c.response.body += addition } }); assert.equal(evidence.listingComplete, false)
})
test('inert stylesheet does not hide a genuine full native role body', async () => {
  const { jobs, evidence } = await run({ india: true, mutate: c => { if (c.url === D) c.response.body += '<template><style>.job-details-content{display:none}</style></template>' } })
  assert.equal(jobs.length, 1); assert.equal(evidence.listingComplete, true)
})
for (const change of [html => html + '<style>form{display:none}</style>', html => html.replace('href="#applicant-form"', 'href="#applicant-form" style="opacity:0"')]) test('closing application visibility changes exclude the role', async () => {
  const { jobs, evidence } = await run({ india: true, mutate: c => { if (c.url === D && c.occurrence === 2) c.response.body = change(c.response.body) } })
  assert.equal(jobs.length, 0); assert.equal(evidence.listingComplete, false)
})
test('multiple native postings and all closing details are read before a real output cap', async () => {
  const full = await run({ india: true, extraRole: true }); assert.equal(full.jobs.length, 2); assert.equal(full.evidence.listingComplete, true, full.evidence.reason)
  const capped = await run({ india: true, extraRole: true, maxJobs: 1 }); assert.equal(capped.jobs.length, 1); assert.equal(capped.calls.length, 14); assert.equal(capped.evidence.listingComplete, false); assert.match(capped.evidence.reason, /source-job-limit/)
})
test('declared native department counts must reconcile with the full native feed', async () => {
  const { evidence } = await run({ india: true, extraRole: true, mutate: c => { if (c.url === B + '/jobs') c.response.body = c.response.body.replace('<span data-portal-id="mobile-jobs-count"></span>', '<span data-portal-id="mobile-jobs-count">1</span>') } })
  assert.equal(evidence.listingComplete, false)
})
test('unverified native widget code cannot publish India roles', async () => {
  const { jobs, evidence } = await run({ india: true, mutate: c => { if (c.url === J && c.occurrence === 2) c.response.body += '\n/* changed public native client */' } })
  assert.equal(jobs.length, 0); assert.equal(evidence.listingComplete, false)
})
