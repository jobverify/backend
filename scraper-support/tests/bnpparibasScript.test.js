import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

const loadBnpModule = async () => {
  try {
    return await import('../../scraper/bnpparibas/script.js')
  } catch {
    return null
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'bnpparibas',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildSearchUrl keeps BNP Paribas listings on the public India Solutions offers pages', async () => {
  const bnp = await loadBnpModule()
  assert.ok(bnp)

  assert.equal(
    bnp.buildSearchUrl(),
    'https://group.bnpparibas/en/careers/all-job-offers/bnp-paribas-india-solutions',
  )
  assert.equal(
    bnp.buildSearchUrl({ page: 3 }),
    'https://group.bnpparibas/en/careers/all-job-offers/bnp-paribas-india-solutions?page=3',
  )
})

test('extractSearchResults parses BNP Paribas public offer cards into shared scraper fields', async () => {
  const bnp = await loadBnpModule()
  assert.ok(bnp)

  const jobs = bnp.extractSearchResults(readFixture('search-results-page-1.html'))

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Senior API Engineer',
    company: 'BNP Paribas',
    department: 'BNP Paribas India Solutions',
    location: 'Mumbai, Karnataka, India',
    city: 'Mumbai',
    country: 'India',
    jobId: 'senior-api-engineer',
    requisitionId: 'senior-api-engineer',
    sourceUrl: 'https://group.bnpparibas/en/careers/job-offer/senior-api-engineer',
    applyUrl: 'https://group.bnpparibas/en/careers/job-offer/senior-api-engineer',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })

  assert.equal(jobs[1].jobId, 'senior-automation-tester-1')
  assert.equal(jobs[1].city, 'Chennai')
})

test('extractPaginationSummary reads BNP Paribas next-page links from the public offers pages', async () => {
  const bnp = await loadBnpModule()
  assert.ok(bnp)

  assert.deepEqual(
    bnp.extractPaginationSummary(readFixture('search-results-page-1.html')),
    {
      nextUrl: 'https://group.bnpparibas/en/careers/all-job-offers/bnp-paribas-india-solutions?page=2',
    },
  )
})

test('extractJobDetail reads BNP Paribas detail metadata, description, and external apply links', async () => {
  const bnp = await loadBnpModule()
  assert.ok(bnp)

  const detail = bnp.extractJobDetail(readFixture('job-detail-senior-api-engineer.html'), {
    title: 'Senior API Engineer',
    company: 'BNP Paribas',
    department: 'BNP Paribas India Solutions',
    location: 'Mumbai, Karnataka, India',
    city: 'Mumbai',
    country: 'India',
    jobId: 'senior-api-engineer',
    requisitionId: 'senior-api-engineer',
    sourceUrl: 'https://group.bnpparibas/en/careers/job-offer/senior-api-engineer',
    applyUrl: 'https://group.bnpparibas/en/careers/job-offer/senior-api-engineer',
  })

  assert.equal(detail.title, 'Senior API Engineer')
  assert.equal(detail.company, 'BNP Paribas')
  assert.equal(detail.department, 'BNP Paribas India Solutions')
  assert.equal(detail.location, 'Mumbai, Karnataka, India')
  assert.equal(detail.city, 'Mumbai')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, '101029')
  assert.equal(detail.requisitionId, '101029')
  assert.equal(detail.employmentType, 'Full-time')
  assert.match(detail.experienceRequired, /> 5 years of experience/i)
  assert.equal(detail.minimumQualification, 'Bachelor Degree or equivalent')
  assert.equal(detail.preferredQualification, null)
  assert.equal(detail.postingDate, '2026-06-29')
  assert.equal(detail.closingDate, null)
  assert.ok(detail.requiredSkills.includes('Strong experience in API proxy development and policies on Apigee API gateway'))
  assert.ok(detail.requiredSkills.includes('Strong communication and collaboration skills.'))
  assert.match(detail.jobDescription, /Senior API Engineer will be responsible/i)
  assert.equal(
    detail.applyUrl,
    'https://bwelcome.hr.bnpparibas/en_US/externalcareers/JobDetails?jobId=101029&source=BNP+Paribas+website',
  )
  assert.equal(
    detail.sourceUrl,
    'https://group.bnpparibas/en/careers/job-offer/senior-api-engineer',
  )
})

test('normalizeScrapedJob composes BNP Paribas experienced technology roles from the public detail pages', async () => {
  const bnp = await loadBnpModule()
  assert.ok(bnp)

  const detail = bnp.extractJobDetail(readFixture('job-detail-senior-api-engineer.html'), {
    title: 'Senior API Engineer',
    company: 'BNP Paribas',
    department: 'BNP Paribas India Solutions',
    location: 'Mumbai, Karnataka, India',
    city: 'Mumbai',
    country: 'India',
    jobId: 'senior-api-engineer',
    requisitionId: 'senior-api-engineer',
    sourceUrl: 'https://group.bnpparibas/en/careers/job-offer/senior-api-engineer',
    applyUrl: 'https://group.bnpparibas/en/careers/job-offer/senior-api-engineer',
  })

  const normalized = normalizeScrapedJob(detail, {
    source: 'bnpparibas',
    companyName: 'BNP Paribas',
    companyCareerPage: 'https://group.bnpparibas/en/careers/all-job-offers/bnp-paribas-india-solutions',
    atsPlatform: 'official-company-careers',
  })

  assert.equal(normalized.employmentType, 'Full-time')
  assert.equal(normalized.jobType, 'Full-time Experienced')
})

test('run paginates BNP Paribas public offer pages, enriches detail pages, and decorates shared runner fields', async () => {
  const bnp = await loadBnpModule()
  assert.ok(bnp)

  const requests = []
  const scraper = bnp.createBnppScraper({ maxPages: 1, maxJobs: 1 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === bnp.buildSearchUrl()) {
        return readFixture('search-results-page-1.html')
      }
      if (url === 'https://group.bnpparibas/en/careers/job-offer/senior-api-engineer') {
        return readFixture('job-detail-senior-api-engineer.html')
      }
      throw new Error(`Unexpected BNP Paribas URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    bnp.buildSearchUrl(),
    'https://group.bnpparibas/en/careers/job-offer/senior-api-engineer',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'bnpparibas')
  assert.equal(jobs[0].company, 'BNP Paribas')
  assert.equal(jobs[0].jobId, '101029')
  assert.equal(
    jobs[0].applyUrl,
    'https://bwelcome.hr.bnpparibas/en_US/externalcareers/JobDetails?jobId=101029&source=BNP+Paribas+website',
  )
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
