import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'

import {createCatalogScraper, getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence, sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {
  CAREER_PAGE_URL,
  createAanandPJangidAndAssociatesScraper,
  extractSearchResults,
  hasOfficialCareersSurface,
} from './script.js'

const SOURCE = 'aanandpjangidandassociates'
const fixture = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/current-title-only-20261128.json.gz', import.meta.url))))
const packet = fixture.packets[0]
const html = packet.body
const titles = ['Data Analytics Consultant', 'Cyber Security Analyst', 'Forensic Audit Manager']
const heldFields = [
  'sourceCountryComplete', 'sourceDetailComplete', 'sourceApplicationQualificationComplete',
  'activeApplyVerified', 'sourceListingComplete', 'sourceScopeComplete', 'lifecycleCleanupAllowed',
]
const run = (body = html) => createAanandPJangidAndAssociatesScraper().run({
  fetchText: async url => {
    assert.equal(url, CAREER_PAGE_URL)
    return body
  },
})

test('genuine current AJA fixture preserves its one original HTTP body and empty native criteria', () => {
  assert.equal(fixture.source, SOURCE)
  assert.equal(fixture.packets.length, 1)
  assert.equal(packet.method, 'GET')
  assert.equal(packet.status, 200)
  assert.equal(packet.requestedUrl, CAREER_PAGE_URL)
  assert.equal(packet.url, CAREER_PAGE_URL)
  assert.equal(Buffer.byteLength(html), 7586)
  assert.equal(packet.sha256, '261572f89f7eb4cdb180b8caffd1cff7b3b42e1ed45e022e2d1046df2134d308')
  assert.equal(createHash('sha256').update(html).digest('hex'), packet.sha256)
  assert.equal([...html.matchAll(/class="job-card-body"><p><\/p>/g)].length, 3)
  for (const office of ['USA New Jersey', 'United Arab Emirates', 'Bangalore', 'Thiruvananthapuram']) assert.ok(html.includes(office))
})

test('current official identity still qualifies and all three native titles remain observations', async () => {
  assert.equal(hasOfficialCareersSurface(html), true)
  assert.deepEqual((await run()).map(job => job.title), titles)
})

test('empty current cards do not acquire a role country, city, location or remote status', async () => {
  for (const job of await run()) {
    for (const field of ['country', 'city', 'location', 'remoteStatus']) assert.equal(job[field], null, `${job.title}: ${field}`)
  }
})

test('native titles and generic contact navigation do not become descriptions or qualified application links', async () => {
  for (const job of await run()) {
    assert.equal(job.applyUrl, null)
    assert.equal(job.jobDescription, null)
    assert.equal(job.minimumQualification, null)
    assert.equal(job.preferredQualification, null)
    assert.equal(job.experienceRequired, null)
    assert.deepEqual(job.requiredSkills, [])
    assert.equal(job.sourceUrl, `${CAREER_PAGE_URL}#open-positions`)
    assert.equal(job.link, job.sourceUrl)
  }
})

test('each current title retains explicit country, detail, application, inventory, scope and cleanup holds', async () => {
  for (const job of await run()) {
    for (const field of heldFields) assert.equal(job[field], false, `${job.title}: ${field}`)
    assert.deepEqual(job.sourceQualificationHolds, ['role-country-unproven', 'role-details-unproven', 'application-unproven', 'inventory-scope-unproven'])
  }
})

test('current complete HTML including all criteria, footer offices and application script is retained verbatim', async () => {
  const jobs = await run()
  assert.equal(jobs.nativeCollectionEvidence.rawHtml, html)
  assert.deepEqual(jobs.nativeCollectionEvidence.observations.map(row => row.title), titles)
  for (const job of jobs) {
    assert.equal(job.nativeObservation.title, job.title)
    assert.equal(job.nativeObservation.rawHtml, html)
    assert.ok(job.nativeObservation.openingsHtml.startsWith('<section class="open-positions-section" id="open-positions">'))
    assert.ok(job.nativeObservation.openingsHtml.includes('<p></p>'))
    assert.ok(!job.nativeObservation.openingsHtml.includes('<footer'))
  }
})

test('observed three is bounded source evidence rather than an authoritative company total or inventory', async () => {
  const jobs = await run()
  assert.deepEqual(readSourceObservationEvidence(jobs, SOURCE), {
    source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: 3, observedVacancyCount: 3,
    sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null,
  })
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.status, 'coverage-gap')
  assert.equal(inventory.firstParty, true)
  assert.equal(inventory.surface, CAREER_PAGE_URL)
  assert.equal(inventory.pagesFetched, 1)
  assert.equal(inventory.listingComplete, false)
  assert.equal(inventory.lifecycleCleanupAllowed, false)
  assert.equal(inventory.reportedTotal, null)
  assert.equal(inventory.indiaFacetCount, null)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('registered source keeps the native observations and reports a held coverage gap with no qualified India result', async () => {
  const provider = getScraperCatalog().find(row => row.source === SOURCE)
  const jobs = await createCatalogScraper(provider).run({fetchText: async () => html})
  const assessment = assessSoftFailureAcquisition(provider, jobs)
  assert.deepEqual(jobs.map(job => job.title), titles)
  for (const job of jobs) {
    for (const field of ['country', 'city', 'location', 'remoteStatus']) assert.equal(job[field], null)
    for (const field of heldFields) assert.equal(job[field], false)
    // The catalog copies an observation link into applyUrl. This navigation
    // fallback must retain its explicit lack of application qualification.
    assert.equal(job.applyUrl, job.sourceUrl)
    assert.equal(job.sourceApplicationQualificationComplete, false)
    assert.equal(job.activeApplyVerified, false)
  }
  assert.equal(jobs.nativeCollectionEvidence.rawHtml, html)
  assert.equal(readSourceObservationEvidence(jobs, SOURCE).observedRecordCount, 3)
  assert.equal(assessment.rawJobs, 3)
  assert.equal(assessment.indiaJobs, 0)
  assert.equal(assessment.eligibleJobs, 0)
  assert.equal(assessment.runnerOutcome.rawRecords, 3)
  assert.equal(assessment.runnerOutcome.success, false)
  assert.equal(assessment.runnerOutcome.failureKind, 'coverage_gap')
  assert.equal(assessment.runnerOutcome.zeroJobEvidence, 'coverage-gap')
  assert.equal(assessment.runnerOutcome.partial, true)
  assert.equal(assessment.runnerOutcome.processingComplete, true)
  assert.deepEqual(assessment.cleanupOptions, {replaceExisting: false})
})

for (const footer of ['India', 'Remote work from India', 'USA New Jersey', 'United Arab Emirates', 'Bangalore', 'Thiruvananthapuram']) {
  test(`footer-only ${footer} does not supply any role location or remote proof`, () => {
    const changed = html.replace(/<footer\b[\s\S]*?<\/footer>/, `<footer>${footer}</footer>`)
    assert.equal(hasOfficialCareersSurface(changed), true)
    const jobs = extractSearchResults(changed)
    assert.deepEqual(jobs.map(job => job.title), titles)
    for (const job of jobs) {
      assert.equal(job.country, null)
      assert.equal(job.location, null)
      assert.equal(job.remoteStatus, null)
    }
  })
}

test('a title containing India and Remote is retained without inventing a qualified native workplace', async () => {
  const changed = html.replaceAll('Data Analytics Consultant', 'Data Analytics Consultant - India - Remote')
  const jobs = await run(changed)
  assert.equal(jobs[0].title, 'Data Analytics Consultant - India - Remote')
  assert.equal(jobs[0].country, null)
  assert.equal(jobs[0].remoteStatus, null)
  assert.equal(jobs[0].sourceCountryComplete, false)
})

test('unreviewed card content and outbound application href stay raw without granting completeness or application authority', async () => {
  const changed = html.replace('<div class="job-card-body"><p></p>', '<div class="job-card-body"><p>Native criterion preserved exactly.</p>')
    .replace('href="#" class="apply-btn"', 'href="https://example.org/unreviewed-apply" class="apply-btn"')
  const jobs = await run(changed)
  assert.equal(jobs[0].nativeObservation.rawHtml, changed)
  assert.ok(jobs[0].nativeObservation.openingsHtml.includes('Native criterion preserved exactly.'))
  assert.equal(jobs[0].applyUrl, null)
  assert.equal(jobs[0].jobDescription, null)
  for (const field of heldFields) assert.equal(jobs[0][field], false)
})

for (const [name, change] of [
  ['title', body => body.replace('AJA - Careers', 'Another employer - Careers')],
  ['team identity', body => body.replace('Join Our Team', 'Other Team')],
  ['openings heading', body => body.replace('Current Openings', 'Archived Posts')],
  ['positions navigation', body => body.replace('View Open Positions', 'View Posts')],
  ['job-card classes', body => body.replaceAll('job-card', 'unreviewed-card')],
  ['native title attributes', body => body.replaceAll('data-job-title=', 'data-other-title=')],
]) {
  test(`unchanged original identity guard rejects missing ${name}`, async () => {
    const changed = change(html)
    assert.equal(hasOfficialCareersSurface(changed), false)
    await assert.rejects(run(changed), /no longer matches the verified public openings surface/)
  })
}

test('an empty current openings section remains a failure rather than a successful company zero', async () => {
  const changed = html.replace(/data-job-title="[^"]*"/g, 'data-job-title=""').replace(/<h3>(Data Analytics Consultant|Cyber Security Analyst|Forensic Audit Manager)<\/h3>/g, '<h3></h3>')
  assert.equal(hasOfficialCareersSurface(changed), true)
  await assert.rejects(run(changed), /no longer contains job cards/)
})
