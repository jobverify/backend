import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import { analyzePublishableJobs } from '../utils/publishableJobMetrics.js'
import { extractionDetailHealth } from '../utils/extractionDetailHealth.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { enrichJobWithPublicExperience, enrichJobsWithPublicExperience } from '../utils/publicExperienceEnrichment.js'

const thence = await import('../../scraper/thence/script.js')
const capture = JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/thence/fixtures/live20261111.json.gz', import.meta.url))))
const home = Buffer.from(capture.originalPages[2].rawBodyBase64, 'base64').toString('utf8')
const careers = Buffer.from(capture.originalPages[3].rawBodyBase64, 'base64').toString('utf8')

// The positive replay uses the actual eight distinct opening/closing responses.
// Optional mutations below are controlled negative cases, never native captures.
function replay(change) {
  const used = []
  return {
    used,
    fetchImpl: async (url, init) => {
      const index = used.length
      const packet = capture.originalPages[index]
      assert.ok(packet, 'unexpected request beyond captured opening and closing reads')
      assert.equal(url, packet.url)
      assert.equal(init.method, 'GET')
      assert.equal(init.redirect, 'manual')
      assert.equal(init.credentials, 'omit')
      used.push(packet)
      let body = Buffer.from(packet.rawBodyBase64, 'base64')
      if (change) body = change(body, index)
      const response = new Response(body, { status: packet.status, headers: packet.headers })
      Object.defineProperty(response, 'url', { value: packet.finalUrl })
      return response
    },
  }
}

test('Thence validates its current corporate handoff and preserves all sixteen native application choices', () => {
  assert.equal(thence.SOURCE, 'thence')
  assert.equal(thence.COMPANY, 'Thence Private Limited')
  assert.equal(thence.HOMEPAGE_URL, 'https://thence.co')
  assert.equal(thence.CAREERS_URL, 'https://www.thence.digital/careers')
  assert.equal(thence.APPLY_URL, 'https://www.thence.digital/careers#section-contact-us-form')
  assert.equal(thence.hasOfficialHomepageSignal(home), true)
  assert.equal(thence.extractCareersUrlFromHomepage(home), thence.CAREERS_URL)
  assert.equal(thence.hasOfficialCareersSignal(careers), true)
  const choices = thence.extractOpenRoles(careers)
  assert.deepEqual(choices.map(choice => choice.title), [
    'Product Data Analyst', 'UI Tester', 'Engineering Head', 'UI Designer',
    'Account Executive - Sales', "Asst. Manager - Founder's Office", 'Front-end Developer',
    'Senior Manager - Business Content & Communication', 'UX Intern', 'UX Designer',
    'Project Manager - Engineering', 'UX Researcher', 'Senior UX Designer',
    'Product Consultant/APC', 'Sales Manager - Tech', "PMO - CEO's Office",
  ])
  assert.equal(choices[0].jobId, 'thence-product-data-analyst')
  assert.equal(new Set(choices.map(choice => choice.jobId)).size, 16)
  for (const choice of choices) {
    assert.equal(choice.sourceRecordKind, 'application-role-choice')
    assert.equal(choice.sourceNativeVacancyConfirmed, false)
    assert.equal(choice.country, null)
    assert.equal(choice.location, null)
    assert.equal(choice.requisitionId, null)
    assert.equal(choice.nativeLegalEmployer, null)
    assert.equal(choice.jobDescription, null)
  }
})

test('Thence shared applicant salary, experience and job-type inputs do not establish vacancy requirements', () => {
  assert.match(careers, /Current-CTC-LPA-INR/)
  assert.match(careers, /Relevant-years-of-experience/)
  assert.match(careers, /Current-job-type/)
  const choices = thence.extractOpenRoles(careers)
  assert.equal(choices.length, 16)
  for (const choice of choices) {
    assert.equal(choice.experienceRequired, null)
    assert.equal(choice.employmentType, null)
    assert.equal(choice.minimumQualification, null)
    assert.deepEqual(choice.requiredSkills, [])
    assert.equal(choice.sourceExperienceEvidenceKind, 'shared-applicant-intake-not-own-role-requirement')
    assert.equal(choice.sourceDetailComplete, false)
  }
})

test('Thence normalization preserves unknown country and missing criteria against an India provider default', () => {
  const choices = thence.extractOpenRoles(careers)
  const normalized = choices.map(choice => normalizeScrapedJob(choice, {
    source: thence.SOURCE, companyName: thence.COMPANY,
    companyCareerPage: thence.CAREERS_URL, countryFilter: 'India', country: 'India',
  }))
  assert.equal(normalized.length, 16)
  for (const choice of normalized) {
    assert.equal(choice.country, null)
    assert.equal(choice.jobDescription, null)
    assert.equal(choice.experienceRequired, null)
    assert.equal(choice.requisitionId, null)
  }
  assert.equal(analyzePublishableJobs(normalized).indiaJobs.length, 0)
  assert.equal(analyzePublishableJobs(normalized).eligibleJobs.length, 0)
  assert.equal(extractionDetailHealth(choices).missingDescriptions, 16)
})

test('Thence run checks distinct current opening and closing responses while retaining application candidates', async () => {
  const r = replay()
  const choices = await thence.createThenceScraper().run({ fetchImpl: r.fetchImpl })
  assert.equal(r.used.length, 8)
  assert.deepEqual(r.used.map(packet => packet.url), capture.originalPages.map(packet => packet.url))
  assert.equal(choices.length, 16)
  assert.equal(choices[0].source, thence.SOURCE)
  assert.equal(choices[0].link, thence.APPLY_URL)
  assert.match(choices[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.equal(choices.sourceAudit.observedApplicationRoleChoices, 16)
  assert.equal(choices.sourceAudit.confirmedNativeVacancyTotal, null)
  assert.equal(choices.sourceAudit.confirmedIndiaVacancyTotal, null)
  assert.equal(choices.sourceAudit.closingCorporateMatches, true)
  assert.equal(choices.sourceAudit.closingApplicationChoicesMatch, true)
  assert.deepEqual(choices.sourceAudit.originalPages.map(packet => packet.rawBodyBase64), r.used.map(packet => packet.rawBodyBase64))
  const inventory = readInventoryEvidence(choices)
  assert.equal(inventory.listingComplete, false)
  assert.equal(inventory.lifecycleCleanupAllowed, false)
  assert.equal(inventory.reportedTotal, null)
  assert.equal(analyzePublishableJobs(choices).indiaJobs.length, 0)
})

test('Thence fails closed when its current publisher, careers handoff or application selector changes', async () => {
  const changedPublisher = replay((body, index) => index === 2
    ? Buffer.from(body.toString('utf8').replace('<title>Thence Digital</title>', '<title>Another Company</title>')) : body)
  await assert.rejects(thence.createThenceScraper().run({ fetchImpl: changedPublisher.fetchImpl }), /publisher/)
  assert.equal(changedPublisher.used.length, 3)
  const changedHandoff = replay((body, index) => index === 2
    ? Buffer.from(body.toString('utf8').replaceAll('href="/careers"', 'href="https://jobs.example.com/thence"')) : body)
  await assert.rejects(thence.createThenceScraper().run({ fetchImpl: changedHandoff.fetchImpl }), /careers handoff/)
  assert.equal(changedHandoff.used.length, 3)
  const changedForm = replay((body, index) => index === 3
    ? Buffer.from(body.toString('utf8').replace('id="jaf-select_role"', 'id="other-selector"')) : body)
  await assert.rejects(thence.createThenceScraper().run({ fetchImpl: changedForm.fetchImpl }), /role selector/)
  assert.equal(changedForm.used.length, 4)
})

test('Thence rejects metadata-free callbacks before they can imply verified redirects or an empty inventory', async () => {
  let reads = 0
  await assert.rejects(thence.createThenceScraper().run({
    fetchText: async () => { reads++; return home },
  }), /HTTP response metadata required/)
  assert.equal(reads, 0)
})

test('Thence shared application candidates bypass generic enrichment without inventing zero experience', async () => {
  const normalized = thence.extractOpenRoles(careers).map(choice => normalizeScrapedJob(choice, {
    source: thence.SOURCE, companyName: thence.COMPANY, countryFilter: 'India',
  }))
  let reads = 0
  const options = {
    fetchText: async () => { reads++; return { html: careers, status: 200, url: thence.CAREERS_URL } },
    fetchJson: async () => { reads++; return {} },
    fetchBrowserText: async () => { reads++; return { html: careers, status: 200, url: thence.CAREERS_URL } },
  }
  const analyst = await enrichJobWithPublicExperience(normalized[0], options)
  assert.equal(analyst.experienceRequired, null)
  assert.equal(reads, 0)
  const choices = await enrichJobsWithPublicExperience(normalized, options)
  assert.equal(choices.length, 16)
  assert.equal(reads, 0)
  for (const choice of choices) {
    assert.equal(choice.experienceRequired, null)
    assert.equal(choice.jobDescription, null)
    assert.equal(choice.country, null)
    assert.equal(choice.requisitionId, null)
    assert.equal(choice.publicExperienceChecked, false)
    assert.equal(choice.skipPublicExperienceEnrichment, true)
  }
})
