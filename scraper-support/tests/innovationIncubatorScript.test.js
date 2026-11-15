import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'innovationincubator',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedCareersHtml = readFixture('careers.html')
const verifiedDetailHtml = readFixture('job-detail-erp-finance-specialist.html')
const currentCareersHtml = gunzipSync(readFileSync(path.join(fixturesDir, 'current-careers-20261115.html.gz'))).toString('utf8')
const emptyCareersHtml = `<html><head><title>Careers - Innovation Incubator</title><link rel="canonical" href="https://innovationincubator.com/careers/"></head><body>We empower everyone to embark on their own career growth<h2>Current Openings</h2><div id="job-openings--grid" data-widget_type="posts.custom"><div class="elementor-posts-nothing-found"></div></div></body></html>`

const loadInnovationIncubatorModule = async () => {
  try {
    return await import('../../scraper/innovationincubator/script.js')
  } catch {
    assert.fail('Expected Innovation Incubator scraper module at ../../scraper/innovationincubator/script.js')
  }
}

test('Innovation Incubator recognizes the verified first-party careers page and extracts first-party job cards', async () => {
  const innovationIncubator = await loadInnovationIncubatorModule()

  assert.equal(innovationIncubator.SOURCE, 'innovationincubator')
  assert.equal(innovationIncubator.COMPANY, 'Innovation Incubator')
  assert.equal(innovationIncubator.CAREERS_PAGE_URL, 'https://innovationincubator.com/careers/')
  assert.equal(innovationIncubator.hasOfficialCareersPageSignal(verifiedCareersHtml), true)

  const jobs = innovationIncubator.extractJobCards(verifiedCareersHtml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'ERP Finance Specialist',
    company: 'Innovation Incubator',
    department: null,
    location: 'Trivandrum Remote',
    city: 'Trivandrum',
    country: null,
    jobId: 'erp-finance-specialist',
    requisitionId: 'erp-finance-specialist',
    sourceUrl: 'https://innovationincubator.com/job/erp-finance-specialist/',
    applyUrl: 'https://innovationincubator.com/job/erp-finance-specialist/',
    employmentType: 'FULL TIME',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
})

test('Innovation Incubator keeps current blank widget observations as an unresolved inventory with cleanup forbidden', async () => {
  const innovationIncubator = await loadInnovationIncubatorModule()
  const jobs = await innovationIncubator.createInnovationIncubatorScraper().run({
    fetchText: async url => {
      assert.equal(url, innovationIncubator.CAREERS_PAGE_URL)
      return emptyCareersHtml
    },
    now: () => '2026-10-03T00:00:00.000Z',
  })
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs)?.status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, null)
  assert.equal(readInventoryEvidence(jobs)?.lifecycleCleanupAllowed, false)
  assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete, false)
})

test('Innovation Incubator retains full visible role observations while holding legacy country and employer claims', async () => {
  const innovationIncubator = await loadInnovationIncubatorModule()

  const detail = innovationIncubator.extractJobDetail(verifiedDetailHtml, {
    title: 'ERP Finance Specialist',
    company: 'Innovation Incubator',
    department: null,
    location: 'Trivandrum Remote, India',
    city: 'Trivandrum',
    country: 'India',
    jobId: 'erp-finance-specialist',
    requisitionId: 'erp-finance-specialist',
    sourceUrl: 'https://innovationincubator.com/job/erp-finance-specialist/',
    applyUrl: 'https://innovationincubator.com/job/erp-finance-specialist/',
    employmentType: 'FULL TIME',
    experienceRequired: '3 to 4 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['SAP', 'Oracle NetSuite', 'Microsoft Dynamics 365', 'Workday'],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Key Skills: SAP, Oracle NetSuite, Microsoft Dynamics 365, Workday',
  })

  assert.match(detail.jobDescription, /We are seeking a detail-oriented and analytical ERP Finance Specialist/i)
  assert.match(detail.jobDescription, /System Maintenance & Support/i)
  assert.match(detail.minimumQualification, /Bachelor's degree in Finance, Accounting, Management Information Systems/i)

  const requestedUrls = []
  const jobs = await innovationIncubator.createInnovationIncubatorScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === innovationIncubator.CAREERS_PAGE_URL) {
        return verifiedCareersHtml
      }

      if (url === 'https://innovationincubator.com/job/erp-finance-specialist/') {
        return verifiedDetailHtml
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
    now: () => '2026-07-10T17:30:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    innovationIncubator.CAREERS_PAGE_URL,
    'https://innovationincubator.com/job/erp-finance-specialist/',
  ])
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed, false)
  assert.equal(jobs.nativeCollectionEvidence.heldRoles.length, 1)
  assert.match(jobs.nativeCollectionEvidence.heldRoles[0].detail.jobDescription, /detail-oriented and analytical ERP Finance Specialist/i)
  assert.match(jobs.nativeCollectionEvidence.heldRoles[0].reason, /country|employer/i)
})

test('current native widget, inert and hidden copies, and active unread role links never certify zero', async t => {
  const innovationIncubator = await loadInnovationIncubatorModule()
  const start = currentCareersHtml.indexOf('<div class="elementor-element elementor-element-7194fe9 ')
  const end = currentCareersHtml.indexOf('<div class="elementor-element elementor-element-2684eab7 ', start)
  assert.ok(start > 0 && end > start)
  const cases = {
    current: currentCareersHtml,
    inert: currentCareersHtml.slice(0, start) + '<template>' + currentCareersHtml.slice(start, end) + '</template>' + currentCareersHtml.slice(end),
    hidden: currentCareersHtml.replace('id="job-openings--grid"', 'hidden id="job-openings--grid"'),
    unread: currentCareersHtml.replace('</body>', "<a href='https://innovationincubator.com/job/new-current-role/'>Current vacancy</a></body>"),
  }
  for (const [label, html] of Object.entries(cases)) await t.test(label, async () => {
    const jobs = await innovationIncubator.run({ fetchText: async () => html })
    assert.equal(jobs.length, 0)
    const evidence = readInventoryEvidence(jobs)
    assert.equal(evidence.status, 'coverage-gap')
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.reportedTotal, null)
    assert.equal(evidence.indiaFacetCount, null)
    assert.equal(evidence.lifecycleCleanupAllowed, false)
    assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete, false)
    assert.equal(jobs.nativeCollectionEvidence.careers.emptyWidgetStateObserved, label === 'current' || label === 'unread')
    if (label === 'unread') assert.ok(jobs.nativeCollectionEvidence.careers.unreadJobURLs.includes('https://innovationincubator.com/job/new-current-role/'))
  })
})

test('city, foreign and missing card locations never acquire an India country assertion', async () => {
  const innovationIncubator = await loadInnovationIncubatorModule()
  for (const location of ['London, United Kingdom', 'Trivandrum Remote', '']) {
    const cards = innovationIncubator.extractJobCards(verifiedCareersHtml.replaceAll('Trivandrum Remote', location))
    assert.ok(cards.every(card => card.country === null && !card.location?.endsWith(', India')))
  }
})

test('missing, hidden or inert full descriptions cannot borrow the listing teaser or unrelated body text', async t => {
  const innovationIncubator = await loadInnovationIncubatorModule()
  const teaser = { title: 'ERP Finance Specialist', jobDescription: 'Key Skills: SAP, Oracle', country: 'India' }
  const cases = {
    missing: '<html><body><h2>ERP Finance Specialist</h2></body></html>',
    hidden: verifiedDetailHtml.replace('class="section_content"', 'hidden class="section_content"'),
    inert: verifiedDetailHtml.replace('<div class="section_content">', '<template><div class="section_content">').replace('</body>', '</template></body>'),
    unrelated: verifiedDetailHtml.replace('class="post-27507 job type-job status-publish"', 'class="unrelated-example"'),
  }
  for (const [label, html] of Object.entries(cases)) await t.test(label, () => {
    assert.equal(innovationIncubator.extractJobDetail(html, teaser).jobDescription, null)
  })
})
