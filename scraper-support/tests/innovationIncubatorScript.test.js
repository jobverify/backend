import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
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
    location: 'Trivandrum Remote, India',
    city: 'Trivandrum',
    country: 'India',
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

test('Innovation Incubator records verified empty inventory for its explicit no-posts widget', async () => {
  const innovationIncubator = await loadInnovationIncubatorModule()
  assert.equal(innovationIncubator.hasVerifiedEmptyCareersSignal(emptyCareersHtml), true)
  const jobs = await innovationIncubator.createInnovationIncubatorScraper().run({
    fetchText: async url => {
      assert.equal(url, innovationIncubator.CAREERS_PAGE_URL)
      return emptyCareersHtml
    },
    now: () => '2026-10-03T00:00:00.000Z',
  })
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs)?.status, 'verified-empty')
  assert.equal(innovationIncubator.hasVerifiedEmptyCareersSignal(emptyCareersHtml.replace('elementor-posts-nothing-found', 'elementor-post__title')), false)
})

test('Innovation Incubator extracts detail-page descriptions and returns enriched jobs from the verified careers surface', async () => {
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
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'innovationincubator')
  assert.equal(jobs[0].link, 'https://innovationincubator.com/job/erp-finance-specialist/')
  assert.equal(jobs[0].scrapedAt, '2026-07-10T17:30:00.000Z')
  assert.match(jobs[0].jobDescription, /detail-oriented and analytical ERP Finance Specialist/i)
})
