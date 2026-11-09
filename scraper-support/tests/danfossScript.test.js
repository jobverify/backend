import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import {
  buildApplyUrl,
  buildDetailUrl,
  buildSearchRequestPayload,
  extractJobDetail,
  extractSearchResults,
  extractSearchSummary,
} from '../../scraper/danfoss/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'danfoss',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')
const readJsonFixture = (name) => JSON.parse(readFixture(name))

test('buildSearchRequestPayload keeps Danfoss listings on the official SuccessFactors jobs API contract', () => {
  assert.deepEqual(buildSearchRequestPayload(), {
    keywords: '',
    locale: 'en_GB',
    location: 'India',
    pageNumber: 0,
    sortBy: 'recent',
  })

  assert.deepEqual(buildSearchRequestPayload(2), {
    keywords: '',
    locale: 'en_GB',
    location: 'India',
    pageNumber: 2,
    sortBy: 'recent',
  })
})

test('extractSearchResults maps official Danfoss India listings and excludes other countries', () => {
  const jobs = extractSearchResults(readJsonFixture('search-results-page-0.json'))

  assert.deepEqual(jobs, [
    {
      title: 'Master Data Expert & Business Analyst, Procurement',
      location: 'Oragadam, Pune, India',
      city: 'Oragadam',
      state: null,
      jobId: '50011',
      requisitionId: '50011',
      sourceUrl: 'https://jobs.danfoss.com/job/Master-Data-Expert-&-Business-Analyst%2C-Procurement/50011-en_GB/',
      applyUrl: 'https://jobs.danfoss.com/talentcommunity/apply/50011/?locale=en_GB',
      postingDate: '24/06/2026',
      closingDate: null,
    },
  ])
})

test('extractSearchSummary reads Danfoss result counts from the public API response', () => {
  assert.deepEqual(extractSearchSummary(readJsonFixture('search-results-page-0.json')), {
    totalJobCount: 45,
    pageSize: 2,
  })
})

test('extractJobDetail maps Danfoss public detail pages into shared scraper fields', () => {
  const detail = extractJobDetail(readFixture('job-detail-50011.html'), {
    title: 'Master Data Expert & Business Analyst, Procurement',
    location: 'Oragadam, Pune, India',
    city: 'Oragadam',
    state: null,
    jobId: '50011',
    requisitionId: '50011',
    sourceUrl: buildDetailUrl('Master-Data-Expert-&amp;-Business-Analyst%2C-Procurement', '50011'),
    applyUrl: buildApplyUrl('50011'),
    postingDate: '24/06/2026',
    closingDate: null,
  })

  assert.equal(detail.title, 'Master Data Expert & Business Analyst, Procurement')
  assert.equal(detail.location, 'Oragadam, Pune, India')
  assert.equal(detail.city, 'Oragadam')
  assert.equal(detail.employmentType, 'Full-time')
  assert.match(detail.jobDescription, /combining analytical skills, master data expertise/i)
  assert.deepEqual(detail.requiredSkills, [
    'Lead analysis of procurement master data.',
    'Deliver actionable insights for Procurement Controllers.',
  ])
  assert.equal(detail.applyUrl, 'https://jobs.danfoss.com/talentcommunity/apply/50011/?locale=en_GB')
  assert.equal(detail.sourceUrl, 'https://jobs.danfoss.com/job/Master-Data-Expert-&-Business-Analyst%2C-Procurement/50011-en_GB/')
})

test('extractJobDetail ignores Danfoss script templates when reading the title', () => {
  const detail = extractJobDetail(`
    <script>
      const template = 'itemprop="title"><div class="job-title-master"><h1>${'${titleText}'}</h1></div></span>';
    </script>
    <div class="joblayouttoken">
      <span class="rtltextaligneligible" itemprop="title">Software Engineer</span>
    </div>
    <script>jobID : 48436</script>
  `, {
    title: 'Fallback Title',
    location: 'Pune, India',
    city: 'Pune',
    jobId: '48436',
    sourceUrl: buildDetailUrl('Software-Engineer', '48436'),
    applyUrl: buildApplyUrl('48436'),
  })

  assert.equal(detail.title, 'Software Engineer')
})

test('normalizeScrapedJob keeps Danfoss experience unresolved without an employer requirement', () => {
  const detail = extractJobDetail(readFixture('job-detail-50011.html'), {
    title: 'Master Data Expert & Business Analyst, Procurement',
    location: 'Oragadam, Pune, India',
    city: 'Oragadam',
    jobId: '50011',
    sourceUrl: buildDetailUrl('Master-Data-Expert-&amp;-Business-Analyst%2C-Procurement', '50011'),
    applyUrl: buildApplyUrl('50011'),
    postingDate: '24/06/2026',
  })

  const normalized = normalizeScrapedJob(detail, {
    source: 'danfoss',
    companyName: 'Danfoss',
    companyCareerPage: 'https://jobs.danfoss.com/search/',
    atsPlatform: 'successfactors',
  })

  assert.equal(normalized.employmentType, 'Full-time')
  assert.equal(normalized.experienceLevel, null)
  assert.equal(normalized.jobType, 'Unspecified')
  assert.equal(detail.experienceRequired, null)
  assert.equal(normalized.experienceRequired, null)
  assert.equal(normalized.experienceProfile.minimumYears, null)
  assert.equal(normalized.experienceProfile.maximumYears, null)
  assert.equal(normalized.experienceProfile.hasExplicitExperience, false)
  assert.equal(normalized.seniority, 'Unknown')
  assert.equal(normalized.sourceDescription, detail.jobDescription)
})
