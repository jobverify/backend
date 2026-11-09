import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import * as source from './script.js'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { extractionDetailHealth } from '../../scraper-support/utils/extractionDetailHealth.js'
const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./nativeEvidence/location-cohort-20261031.json.gz', import.meta.url))))
for (const packet of fixture.packets) assert.equal(crypto.createHash('sha256').update(packet.body).digest('hex'), packet.sha256)
const documents = fixture.packets.slice(3, 6)
const titles = ['Financial Analyst - AR', 'Operations Automation Associate', 'Affinity Leads Sales']
const replay = async ({ mutate, registered = false, signal, maxJobs } = {}) => {
  const events = [], operation = registered ? createCatalogScraper(getScraperCatalog().find(row => row.source === 'medibuddy')).run
    : source.createMediBuddyScraper({ maxJobs }).run
  const jobs = await operation({ signal, fetchText: async url => {
    events.push(url)
    const packet = fixture.packets.find(packet => packet.url === url)
    if (!packet || packet.status === 401) throw Object.assign(new Error(packet ? 'Captured first public document denial' : 'Uncaptured read after first denial'), { status: 401, abortRetries: true })
    return mutate ? mutate(packet.body, url) : packet.body
  } })
  return { jobs, events }
}

test('registered MediBuddy preserves17 visible vacancies plus2 unqualified raw variants, exact3 public receipts, one qualified full JD, and stops at first401', async () => {
  const { jobs, events } = await replay({ registered: true })
  assert.equal(jobs.length, 17)
  assert.equal(events.length, 7)
  assert.equal(events.at(-1), fixture.packets[6].url)
  assert.ok(jobs.every(job => job.country === null && job.location === null && job.requisitionId === null))
  assert.ok(jobs.every(job => /^medibuddy-url-[a-f0-9]{64}$/.test(job.jobId)))
  const ops = jobs.find(job => job.title === titles[1])
  assert.equal(ops.jobDescription, documents[1].body)
  assert.equal(ops.sourceDetailComplete, true)
  assert.match(ops.jobDescription, /Managing cross-functional projects/)
  assert.match(ops.jobDescription, /Hands-on knowledge of SQL/)
  assert.equal(jobs.filter(job => job.sourceDetailComplete).length, 1)
  for (const index of [0, 2]) {
    const job = jobs.find(job => job.title === titles[index])
    assert.equal(job.jobDescription, null)
    assert.equal(job.rawNativeRoleEvidence.contentJobDescription, documents[index].body)
    assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
  }
  const inactive = jobs.filter(job => job.rawNativeRoleEvidence.advertisedSourceUrl.includes('hire.trakstar.com'))
  assert.equal(inactive.length, 8)
  assert.ok(inactive.every(job => job.applyUrl === null && job.link === null && job.sourceUrl === job.rawNativeRoleEvidence.sourcePageUrl
    && job.sourceDetailComplete === false && job.rawNativeRoleEvidence.applicationSubmissionQualified === false))
  assert.ok(jobs.filter(job => !job.sourceDetailComplete).every(job => job.applyUrl === null))
  const audit = jobs[0].nativeCollectionEvidence
  assert.equal(audit.observedListingCount, 17)
  assert.equal(audit.observedNativeRecordCount, 19)
  assert.equal(jobs[0].rawExcludedNativeObservations.length, 2)
  const excluded = jobs[0].rawExcludedNativeObservations
  assert.ok(excluded.every(record => record.title === 'Operations - TL/AM' && record.roleIdentityLinkage === 'unqualified'))
  assert.notDeepEqual(excluded[0].advertisedUrls, excluded[1].advertisedUrls, 'Same title cannot deduplicate conflicting native URLs')
  assert.equal(excluded[0].advertisedUrls[0].href, 'https:/https://medibuddy.hire.trakstar.com/jobs/fk0pg7p/medibuddy.hire.trakstar.com/jobs/fk0pg7p/')
  assert.equal(excluded[0].advertisedUrls[1].href, 'https://mhttps://medibuddy.hire.trakstar.com/jobs/fk0pg7u/edibuddy.hire.trakstar.com/jobs/fk0pg7p/')
  assert.equal(excluded[1].advertisedUrls[0].href, 'https://medibuddy.hire.trakstar.com/jobs/fk0pg7u/')
  assert.equal(audit.successfulDetailReads, 3)
  assert.equal(audit.nativeDetailAttempts, 4)
  assert.equal(audit.extractedDetailJobs, 1)
  assert.equal(audit.firstNativeStop.status, 401)
  assert.equal(readSourceObservationEvidence(jobs, 'medibuddy')?.observedRecordCount, 19)
  assert.equal(readSourceObservationEvidence(jobs, 'medibuddy')?.observedVacancyCount, 17)
  assert.equal(readSourceObservationEvidence(jobs, 'medibuddy')?.recordKind, 'mixed')
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.verifiedAt, null)
  const health = extractionDetailHealth(jobs)
  assert.equal(health.complete, false)
  assert.equal(health.inspectedJobs, 17)
  assert.equal(health.incompleteJobs, 17)
  assert.equal(health.missingDescriptions, 16)
  assert.equal(health.nativeCollections[0].candidateDetails, 17)
  assert.equal(health.nativeCollections[0].parsedDetails, 1)
})

for (const index of [0, 2]) test('MediBuddy native title conflict retains raw document ' + titles[index] + ' without full-JD or geography qualification', () => {
  const detail = source.extractGoogleDocDetail(documents[index].body, { title: titles[index] })
  assert.equal(detail.jobDescription, null)
  assert.equal(detail.sourceDetailComplete, false)
  assert.equal(detail.sourceDetailFailureKind, 'identity-mismatch')
  assert.equal(detail.location, null)
  assert.equal(detail.country, null)
  assert.equal(detail.rawNativeRoleEvidence.contentJobDescription, documents[index].body)
})

test('MediBuddy keeps the complete concordant native document bytes and cannot fill workplace from employer boilerplate India', () => {
  const detail = source.extractGoogleDocDetail(documents[1].body, { title: titles[1] })
  assert.equal(detail.jobDescription, documents[1].body)
  assert.equal(detail.sourceDetailComplete, true)
  assert.equal(detail.location, null)
  assert.equal(detail.city, null)
  assert.equal(detail.country, null)
})

test('an explicit differing native role title cannot be replaced by the MediBuddy listing title', () => {
  const detail = source.extractGoogleDocDetail(documents[1].body.replace('Role - Operations Automation Associate', 'Role - Different role'), { title: titles[1] })
  assert.equal(detail.jobDescription, null)
  assert.equal(detail.sourceDetailComplete, false)
})

test('MediBuddy refuses a native document without concordant employer identity', () => {
  const detail = source.extractGoogleDocDetail(documents[1].body.replaceAll('MediBuddy', 'Other Employer'), { title: titles[1] })
  assert.equal(detail.jobDescription, null)
  assert.equal(detail.sourceDetailComplete, false)
})

for (const mutation of ['application', 'conflicting-ATS-role']) test('MediBuddy validates every supplied ' + mutation + ' URL before hydration', async () => {
  await assert.rejects(replay({ mutate: (html, url) => {
    if (mutation === 'application' && url === source.FIRST_PARTY_JOB_PAGES[1]) return html.replaceAll('https://form.typeform.com/to/lCYKMpLE?typeform-source=www.google.com', 'https://other-company.example/apply')
    if (mutation === 'conflicting-ATS-role' && url === source.FIRST_PARTY_JOB_PAGES[0]) {
      let count = 0
      return html.replaceAll('https://medibuddy.hire.trakstar.com/jobs/fk0pg7p/', value => ++count === 2 ? 'https://medibuddy.hire.trakstar.com/jobs/other-role/' : value)
    }
    return html
  } }), /MediBuddy.*(?:URL|identity|application|role)/i)
})

test('a public document HTML challenge stops MediBuddy without parsing inline scripts or attempting another role', async () => {
  const { jobs, events } = await replay({ mutate: (html, url) => url === documents[0].url
    ? '<html><title>Just a moment</title><script>const role="Operations Automation Associate"</script></html>' : html })
  assert.equal(jobs.length, 17)
  assert.equal(events.length, 4)
  assert.ok(jobs.every(job => !job.sourceDetailComplete && job.jobDescription === null))
  assert.equal(jobs[0].nativeCollectionEvidence.successfulDetailReads, 0)
})

test('a zero-output MediBuddy cap preserves19 mixed native records/17 vacancies and never certifies empty company inventory', async () => {
  const { jobs, events } = await replay({ maxJobs: 0 })
  assert.equal(jobs.length, 0)
  assert.equal(events.length, 2)
  assert.equal(readSourceObservationEvidence(jobs, 'medibuddy')?.observedRecordCount, 19)
  assert.equal(readSourceObservationEvidence(jobs, 'medibuddy')?.observedVacancyCount, 17)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('MediBuddy cancellation preserves the exact frozen caller cause before native reads', async () => {
  const controller = new AbortController(), reason = Object.freeze(new Error('Stop MediBuddy'))
  controller.abort(reason)
  await assert.rejects(replay({ signal: controller.signal }), error => error === reason)
})

test('permanently hidden MediBuddy positions cannot supply active jobs', async () => {
  await assert.rejects(replay({ mutate: (html, url) => url === source.FIRST_PARTY_JOB_PAGES[1]
    ? html.replace(/<head\b[^>]*>/i, '$&<style>#available-positions{display:none!important}</style>') : html }), /MediBuddy.*(?:visible|active|positions|scope)/i)
})

test('a malformed literal ATS URL cannot be repaired by finding a valid tenant/role substring inside it', async () => {
  await assert.rejects(replay({ mutate: (html, url) => url === source.FIRST_PARTY_JOB_PAGES[0]
    ? html.replace('https://medibuddy.hire.trakstar.com/jobs/fk0pg7p/', 'https:/https://medibuddy.hire.trakstar.com/jobs/fk0pg7p/medibuddy.hire.trakstar.com/jobs/fk0pg7p/') : html }), /MediBuddy.*(?:URL|ownership|identity)/i)
})

test('permanent hiding cannot turn raw Indore title variants into normalized vacancies', async () => {
  const { jobs } = await replay({ mutate: (html, url) => url === source.FIRST_PARTY_JOB_PAGES[0]
    ? html.replace(/<head\b[^>]*>/i, '$&<style>#job-openings h2{opacity:0}</style>') : html })
  assert.equal(jobs.length, 9)
  assert.equal(jobs[0].rawExcludedNativeObservations.length, 10)
  assert.equal(readSourceObservationEvidence(jobs, 'medibuddy')?.observedRecordCount, 19)
  assert.equal(readSourceObservationEvidence(jobs, 'medibuddy')?.observedVacancyCount, 9)
})

test('a MediBuddy department/role-area label with only a shared program apply route stays an observation', async () => {
  const { jobs } = await replay({ mutate: (html, url) => url === source.FIRST_PARTY_JOB_PAGES[1]
    ? html.replace(/(<div\b[^>]*id="available-positions"[^>]*>)/i, '$1<div><h2>Engineering</h2><a href="https://form.typeform.com/to/lCYKMpLE?typeform-source=www.google.com">Apply</a></div>') : html })
  assert.equal(jobs.length, 17)
  assert.ok(jobs.every(job => job.title !== 'Engineering'))
  assert.equal(readSourceObservationEvidence(jobs, 'medibuddy')?.observedRecordCount, 20)
  assert.equal(readSourceObservationEvidence(jobs, 'medibuddy')?.observedVacancyCount, 17)
})
