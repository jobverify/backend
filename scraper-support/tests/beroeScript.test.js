import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

const loadBeroeModule = async () => {
  try {
    return await import('../../scraper/beroe/script.js')
  } catch {
    return null
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'beroe',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildListingRequest keeps Beroe listings on the public vacancies ajax contract', async () => {
  const beroe = await loadBeroeModule()
  assert.ok(beroe)

  assert.equal(
    beroe.buildListingUrl(),
    'https://www.beroeinc.com/samples/ajax1.filtered-result1',
  )
  assert.equal(
    beroe.buildListingRequestBody(),
    'report_taxo=india&offset=0&limit=9',
  )
  assert.equal(
    beroe.buildListingRequestBody({ offset: 9, limit: 9 }),
    'report_taxo=india&offset=9&limit=9',
  )
})

test('extractListingSummary reads total counts from the Beroe vacancies ajax response', async () => {
  const beroe = await loadBeroeModule()
  assert.ok(beroe)

  const summary = beroe.extractListingSummary(readFixture('ajax-india-page-1.html'))
  assert.deepEqual(summary, {
    totalCount: 16,
  })
})

test('extractListings keeps India Beroe vacancies and drops non-India spillover cards', async () => {
  const beroe = await loadBeroeModule()
  assert.ok(beroe)

  const jobs = beroe.extractListings(readFixture('ajax-india-page-1.html'))

  assert.equal(jobs.length, 7)
  assert.deepEqual(jobs[0], {
    title: 'CRM Specialist (Salesforce & HubSpot)',
    company: 'Beroe',
    department: null,
    location: 'India, Remote',
    city: null,
    country: 'India',
    jobId: 'crm-specialist-salesforce-hubspot',
    requisitionId: 'crm-specialist-salesforce-hubspot',
    sourceUrl: 'https://www.beroeinc.com/careers-vacancies/crm-specialist-salesforce-hubspot/',
    applyUrl: 'https://www.beroeinc.com/careers-vacancies/crm-specialist-salesforce-hubspot/#generic_cta',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: '2026-05-22',
    jobDescription: null,
  })

  assert.equal(jobs.at(-1).jobId, 'analyst-financial-risk')
  assert.equal(jobs.at(-1).location, 'India - Remote')
})

test('extractJobDetail reads Beroe detail content, apply anchor, and required skills', async () => {
  const beroe = await loadBeroeModule()
  assert.ok(beroe)

  const detail = beroe.extractJobDetail(readFixture('detail-crm-specialist.html'), {
    title: 'CRM Specialist (Salesforce & HubSpot)',
    company: 'Beroe',
    department: null,
    location: 'India, Remote',
    city: null,
    country: 'India',
    jobId: 'crm-specialist-salesforce-hubspot',
    requisitionId: 'crm-specialist-salesforce-hubspot',
    sourceUrl: 'https://www.beroeinc.com/careers-vacancies/crm-specialist-salesforce-hubspot/',
    applyUrl: 'https://www.beroeinc.com/careers-vacancies/crm-specialist-salesforce-hubspot/#generic_cta',
    closingDate: '2026-05-22',
  })

  assert.equal(detail.title, 'CRM Specialist (Salesforce & HubSpot)')
  assert.equal(detail.company, 'Beroe')
  assert.equal(detail.department, null)
  assert.equal(detail.location, 'India, Remote')
  assert.equal(detail.city, null)
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, 'crm-specialist-salesforce-hubspot')
  assert.equal(detail.requisitionId, 'crm-specialist-salesforce-hubspot')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '5-8 Years')
  assert.match(detail.jobDescription, /deep understanding of CRM automation, lead lifecycle management, and performance reporting/i)
  assert.equal(detail.minimumQualification, null)
  assert.deepEqual(detail.requiredSkills.slice(0, 4), [
    '3+ years of CRM experience',
    'Mandatory hands-on experience with Salesforce (Reporting)',
    'Mandatory end-to-end operational expertise in HubSpot',
    'Strong knowledge of lead scoring models and automation workflows',
  ])
  assert.equal(detail.postingDate, '2026-05-14')
  assert.equal(detail.closingDate, '2026-05-22')
  assert.equal(
    detail.applyUrl,
    'https://www.beroeinc.com/careers-vacancies/crm-specialist-salesforce-hubspot/#generic_cta',
  )
  assert.equal(
    detail.sourceUrl,
    'https://www.beroeinc.com/careers-vacancies/crm-specialist-salesforce-hubspot/',
  )
})

test('normalizeScrapedJob composes Beroe remote CRM roles from the detail page contract', async () => {
  const beroe = await loadBeroeModule()
  assert.ok(beroe)

  const detail = beroe.extractJobDetail(
    readFixture('detail-crm-specialist.html'),
    beroe.extractListings(readFixture('ajax-india-page-1.html'))[0],
  )

  const normalized = normalizeScrapedJob(detail, {
    source: 'beroe',
    companyName: 'Beroe',
    companyCareerPage: 'https://www.beroeinc.com/careers-vacancies/',
    atsPlatform: 'official-company-careers',
  })

  assert.equal(normalized.company, 'Beroe')
  assert.equal(normalized.country, 'India')
  assert.equal(normalized.remoteStatus, 'Remote')
  assert.equal(normalized.experienceLevel, 'Mid Level')
  assert.equal(normalized.jobType, 'Full-time Experienced')
})

test('run paginates the Beroe ajax vacancies feed, enriches detail pages, and decorates shared runner fields', async () => {
  const beroe = await loadBeroeModule()
  assert.ok(beroe)

  const requests = []
  const scraper = beroe.createBeroeScraper({ maxJobs: 2 })

  const jobs = await scraper.run({
    fetchListings: async ({ url, body }) => {
      requests.push(`${url}?${body}`)
      if (body === beroe.buildListingRequestBody({ offset: 0, limit: 9 })) {
        return readFixture('ajax-india-page-1.html')
      }
      throw new Error(`Unexpected Beroe listings request: ${body}`)
    },
    fetchText: async (url) => {
      requests.push(url)
      if (url === 'https://www.beroeinc.com/careers-vacancies/crm-specialist-salesforce-hubspot/') {
        return readFixture('detail-crm-specialist.html')
      }
      if (url === 'https://www.beroeinc.com/careers-vacancies/generative-ai-research-strategy-lead-2/') {
        return readFixture('detail-crm-specialist.html')
          .replaceAll('CRM Specialist (Salesforce &amp; HubSpot)', 'Generative AI Research &amp; Strategy Lead')
          .replaceAll('CRM Specialist (Salesforce & HubSpot)', 'Generative AI Research & Strategy Lead')
          .replaceAll('Experience Required: 5-8 Years', 'Experience Required: 8-12 Years')
          .replaceAll('Salesforce and HubSpot', 'Generative AI strategy and research programs')
          .replaceAll('Salesforce (Reporting)', 'Generative AI roadmap design')
          .replaceAll('HubSpot', 'LLM research')
      }
      throw new Error(`Unexpected Beroe detail URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    `${beroe.buildListingUrl()}?${beroe.buildListingRequestBody({ offset: 0, limit: 9 })}`,
    'https://www.beroeinc.com/careers-vacancies/crm-specialist-salesforce-hubspot/',
    'https://www.beroeinc.com/careers-vacancies/generative-ai-research-strategy-lead-2/',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'beroe')
  assert.equal(jobs[0].company, 'Beroe')
  assert.equal(jobs[0].jobId, 'crm-specialist-salesforce-hubspot')
  assert.equal(jobs[0].closingDate, '2026-05-22')
  assert.equal(
    jobs[0].applyUrl,
    'https://www.beroeinc.com/careers-vacancies/crm-specialist-salesforce-hubspot/#generic_cta',
  )
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
