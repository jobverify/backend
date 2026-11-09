import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

const loadBahwanCyberTekModule = async () => {
  try {
    return await import('../../scraper/bahwancybertek/script.js')
  } catch {
    return null
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'bahwancybertek',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildSearchRequestPayload keeps Bahwan CyberTek listings on the official RippleHire tokenized endpoint contract', async () => {
  const bahwanCyberTek = await loadBahwanCyberTekModule()
  assert.ok(bahwanCyberTek)

  assert.deepEqual(bahwanCyberTek.buildSearchRequestPayload(), {
    page: 0,
    search: '*:*',
    campaignSeq: '',
    token: 'ncskoGgjoqYnuqre7tUl',
    source: 'CAREERSITE',
    pagesize: 10,
  })
})

test('isIndiaListing keeps Bahwan CyberTek India roles when RippleHire mixes domestic and foreign locations', async () => {
  const bahwanCyberTek = await loadBahwanCyberTekModule()
  assert.ok(bahwanCyberTek)

  assert.equal(bahwanCyberTek.isIndiaListing({ countryCode: 'India', city: 'Mumbai' }), true)
  assert.equal(bahwanCyberTek.isIndiaListing({ countryCode: '', city: 'Chennai' }), true)
  assert.equal(bahwanCyberTek.isIndiaListing({ countryCode: 'Singapore', city: 'Singapore' }), false)
})

test('extractSearchResults parses Bahwan CyberTek RippleHire XML and filters listings to India roles', async () => {
  const bahwanCyberTek = await loadBahwanCyberTekModule()
  assert.ok(bahwanCyberTek)

  const xml = readFixture('search-results-page-0.xml')
  const jobs = bahwanCyberTek.extractSearchResults(xml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Database Admin',
    location: 'Mumbai, India',
    city: 'Mumbai',
    jobId: '888299',
    requisitionId: '888299',
    sourceUrl: 'https://bahwancybertek.ripplehire.com/candidate/?token=ncskoGgjoqYnuqre7tUl&source=CAREERSITE#detail/job/888299',
    applyUrl: 'https://bahwancybertek.ripplehire.com/candidate/?token=ncskoGgjoqYnuqre7tUl&source=CAREERSITE#apply/job/888299',
    experienceRequired: '4 - 7 Years',
    postingDate: null,
    department: null,
  })
})

test('extractSearchSummary reads total counts and page offsets from Bahwan CyberTek RippleHire XML', async () => {
  const bahwanCyberTek = await loadBahwanCyberTekModule()
  assert.ok(bahwanCyberTek)

  const xml = readFixture('search-results-page-0.xml')

  assert.deepEqual(bahwanCyberTek.extractSearchSummary(xml), {
    startJobIndex: 0,
    pageSize: 10,
    totalJobCount: 368,
  })
})

test('extractJobDetail pulls Bahwan CyberTek description, department, skills, and apply URLs from the job detail XML', async () => {
  const bahwanCyberTek = await loadBahwanCyberTekModule()
  assert.ok(bahwanCyberTek)

  const detail = bahwanCyberTek.extractJobDetail(readFixture('job-detail-888299.xml'), {
    title: 'Database Admin',
    location: 'Mumbai, India',
    city: 'Mumbai',
    jobId: '888299',
    requisitionId: '888299',
    sourceUrl: bahwanCyberTek.buildDetailUrl('888299'),
    applyUrl: bahwanCyberTek.buildApplyUrl('888299'),
    experienceRequired: '4 - 7 Years',
  })

  assert.equal(detail.title, 'Database Admin')
  assert.equal(detail.location, 'Mumbai, India')
  assert.equal(detail.city, 'Mumbai')
  assert.equal(detail.jobId, '888299')
  assert.equal(detail.requisitionId, '888299')
  assert.equal(detail.department, 'Others')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '4 - 7 Years')
  assert.match(detail.jobDescription, /B\. Tech \/ B\. E/i)
  assert.match(detail.jobDescription, /Supervise backup procedures/i)
  assert.deepEqual(detail.requiredSkills.slice(0, 5), [
    'Experience in administering production databases on ongoing basis to ensure smooth functioning',
    'Should have worked on a least 2 databases namely Oracle 9i, 10g, DB2, MS- SQL, PostGres, etc. with 4+ years of experience.',
    'Sound Knowledge in PL/SQL Programming',
    'Ability to analysis database system and recommend improvements',
    'Supervise backup procedures',
  ])
  assert.equal(detail.postingDate, '26-Jun-2026')
  assert.equal(detail.applyUrl, bahwanCyberTek.buildApplyUrl('888299'))
  assert.equal(detail.sourceUrl, bahwanCyberTek.buildDetailUrl('888299'))
})

test('normalizeScrapedJob composes Bahwan CyberTek experienced database roles from RippleHire detail payloads', async () => {
  const bahwanCyberTek = await loadBahwanCyberTekModule()
  assert.ok(bahwanCyberTek)

  const detail = bahwanCyberTek.extractJobDetail(readFixture('job-detail-888299.xml'), {
    title: 'Database Admin',
    location: 'Mumbai, India',
    city: 'Mumbai',
    jobId: '888299',
    requisitionId: '888299',
    sourceUrl: bahwanCyberTek.buildDetailUrl('888299'),
    applyUrl: bahwanCyberTek.buildApplyUrl('888299'),
    experienceRequired: '4 - 7 Years',
  })

  const normalized = normalizeScrapedJob(detail, {
    source: 'bahwancybertek',
    companyName: 'Bahwan CyberTek',
    companyCareerPage: 'https://bahwancybertek.ripplehire.com/candidate/careers',
    atsPlatform: 'ripplehire',
  })

  assert.equal(normalized.company, 'Bahwan CyberTek')
  assert.equal(normalized.country, 'India')
  assert.equal(normalized.remoteStatus, 'On-site')
  assert.equal(normalized.experienceLevel, 'Mid Level')
  assert.equal(normalized.jobType, 'Full-time Experienced')
})

test('run fetches the Bahwan CyberTek RippleHire listing and detail payloads, then decorates shared runner fields', async () => {
  const bahwanCyberTek = await loadBahwanCyberTekModule()
  assert.ok(bahwanCyberTek)

  const requested = []
  const scraper = bahwanCyberTek.createBahwanCyberTekScraper()

  const jobs = await scraper.run({
    maxPages: 1,
    fetchText: async (url, options = {}) => {
      requested.push({
        url,
        method: options.method || 'GET',
        body: options.body ? String(options.body) : null,
      })

      if (url === 'https://bahwancybertek.ripplehire.com/candidate/candidatejobsearch') {
        return readFixture('search-results-page-0.xml')
      }

      if (url.includes('jobSeq=888299')) {
        return readFixture('job-detail-888299.xml')
      }

      if (url.includes('jobSeq=887494')) {
        return readFixture('job-detail-888299.xml')
          .replaceAll('888299', '887494')
          .replace('Database Admin', 'OIC Developer')
          .replaceAll('Mumbai', 'Chennai')
          .replace('4 - 7 Years', '6 - 8 Years')
          .replace('26-Jun-2026', '25-Jun-2026')
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requested.map((entry) => entry.method), ['POST', 'GET', 'GET'])
  assert.match(requested[0].body, /ncskoGgjoqYnuqre7tUl/)
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'Bahwan CyberTek')
  assert.equal(jobs[0].source, 'bahwancybertek')
  assert.equal(jobs[0].department, 'Others')
  assert.equal(jobs[0].link, 'https://bahwancybertek.ripplehire.com/candidate/?token=ncskoGgjoqYnuqre7tUl&source=CAREERSITE#apply/job/888299')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
