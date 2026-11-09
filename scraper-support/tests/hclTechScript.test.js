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
  hydrateJobDetails,
} from '../../scraper/hcltech/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'hcltech',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')
const readJsonFixture = (name) => JSON.parse(readFixture(name))

test('buildSearchRequestPayload keeps HCLTech listings on the public SuccessFactors jobs API contract', () => {
  assert.deepEqual(buildSearchRequestPayload(), {
    keywords: 'India',
    locale: 'en_US',
    pageNumber: 0,
    sortBy: 'recent',
  })

  assert.deepEqual(buildSearchRequestPayload(2), {
    keywords: 'India',
    locale: 'en_US',
    pageNumber: 2,
    sortBy: 'recent',
  })
})

test('extractSearchResults parses HCLTech SuccessFactors JSON and filters listings to India roles', () => {
  const payload = readJsonFixture('search-results-page-0.json')
  const jobs = extractSearchResults(payload)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'SME - Microsoft Forefront Identity Manager, Azure Active Directory',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    state: null,
    jobId: '116250',
    requisitionId: '116250',
    sourceUrl: 'https://careers.hcltech.com/job/SME-Microsoft-Forefront-Identity-Manager%2C-Azure-Active-Directory/116250-en_US/',
    applyUrl: 'https://careers.hcltech.com/talentcommunity/apply/116250/?locale=en_US&jobID=116250#tracked',
    postingDate: '6/2/26',
    closingDate: '7/2/26',
  })

  assert.deepEqual(jobs[1], {
    title: 'SeniorAdministrator - Microsoft Forefront Identity Manager',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    state: null,
    jobId: '116874',
    requisitionId: '116874',
    sourceUrl: 'https://careers.hcltech.com/job/SeniorAdministrator-Microsoft-Forefront-Identity-Manager/116874-en_US/',
    applyUrl: 'https://careers.hcltech.com/talentcommunity/apply/116874/?locale=en_US&jobID=116874#tracked',
    postingDate: '6/3/26',
    closingDate: '7/3/26',
  })
})

test('extractSearchSummary reads HCLTech total result counts from the SuccessFactors jobs API payload', () => {
  const payload = readJsonFixture('search-results-page-0.json')

  assert.deepEqual(extractSearchSummary(payload), {
    totalJobCount: 109,
    pageSize: 3,
  })
})

test('extractJobDetail pulls HCLTech title, description, experience, and public apply route from a detail page', () => {
  const html = readFixture('job-detail-116250.html')
  const detail = extractJobDetail(html, {
    title: 'SME - Microsoft Forefront Identity Manager, Azure Active Directory',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    state: null,
    jobId: '116250',
    requisitionId: '116250',
    sourceUrl: buildDetailUrl('SME-Microsoft-Forefront-Identity-Manager%2C-Azure-Active-Directory', '116250'),
    applyUrl: buildApplyUrl('116250'),
    postingDate: '6/2/26',
    closingDate: '7/2/26',
  })

  assert.equal(detail.title, 'SME - Microsoft Forefront Identity Manager, Azure Active Directory')
  assert.equal(detail.location, 'Bengaluru, India')
  assert.equal(detail.city, 'Bengaluru')
  assert.equal(detail.experienceRequired, '10+ years')
  assert.match(detail.jobDescription, /LDAP Engineer Band E2\.2/i)
  assert.deepEqual(detail.requiredSkills, [
    'Strong expertise in LDAP protocol and directory services architecture',
    'Good understanding of ForgeRock DS, Active Directory, JAVA, Restful APIs, Github Actions, Kubernetes, and Redis caching',
  ])
  assert.equal(detail.applyUrl, 'https://careers.hcltech.com/talentcommunity/apply/116250/?locale=en_US&jobID=116250#tracked')
  assert.equal(detail.sourceUrl, 'https://careers.hcltech.com/job/SME-Microsoft-Forefront-Identity-Manager%2C-Azure-Active-Directory/116250-en_US/')
})

test('normalizeScrapedJob composes HCLTech experienced full-time job types from the extracted detail data', () => {
  const detail = extractJobDetail(readFixture('job-detail-116250.html'), {
    title: 'SME - Microsoft Forefront Identity Manager, Azure Active Directory',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    state: null,
    jobId: '116250',
    requisitionId: '116250',
    sourceUrl: buildDetailUrl('SME-Microsoft-Forefront-Identity-Manager%2C-Azure-Active-Directory', '116250'),
    applyUrl: buildApplyUrl('116250'),
    postingDate: '6/2/26',
    closingDate: '7/2/26',
  })

  const normalized = normalizeScrapedJob(detail, {
    source: 'hcltech',
    companyName: 'HCLTech',
    companyCareerPage: 'https://careers.hcltech.com/search/',
    atsPlatform: 'successfactors',
  })

  assert.equal(normalized.employmentType, 'Full-time')
  assert.equal(normalized.experienceLevel, 'Senior Level')
  assert.equal(normalized.jobType, 'Full-time Experienced')
})

test('hydrateJobDetails preserves serial requests and forwards cancellation', async () => {
  const listings = Array.from({ length: 7 }, (_, index) => ({
    title: `Role ${index}`,
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    state: null,
    jobId: String(120000 + index),
    requisitionId: String(120000 + index),
    sourceUrl: `https://careers.hcltech.com/job/Role-${index}/${120000 + index}-en_US/`,
    applyUrl: buildApplyUrl(String(120000 + index)),
    postingDate: null,
    closingDate: null,
  }))
  const controller = new AbortController()
  let activeRequests = 0
  let maximumActiveRequests = 0
  const seenSignals = []

  const jobs = await hydrateJobDetails(listings, {
    signal: controller.signal,
    fetchDetail: async (_url, { signal }) => {
      seenSignals.push(signal)
      activeRequests += 1
      maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests)
      await new Promise((resolve) => setImmediate(resolve))
      activeRequests -= 1
      return readFixture('job-detail-116250.html')
    },
  })

  assert.equal(jobs.length, listings.length)
  assert.equal(maximumActiveRequests, 1)
  assert.ok(seenSignals.every((signal) => signal === controller.signal))
})

test('hydrateJobDetails stops scheduling detail requests after cancellation', async () => {
  const controller = new AbortController()
  let requestCount = 0
  const listings = [
    { title: 'First role', jobId: '1', sourceUrl: 'https://careers.hcltech.com/job/first/1-en_US/' },
    { title: 'Second role', jobId: '2', sourceUrl: 'https://careers.hcltech.com/job/second/2-en_US/' },
  ]

  await assert.rejects(
    hydrateJobDetails(listings, {
      signal: controller.signal,
      fetchDetail: async () => {
        requestCount += 1
        controller.abort(new Error('runner stopped'))
        return readFixture('job-detail-116250.html')
      },
    }),
    /runner stopped/i,
  )

  assert.equal(requestCount, 1)
})

test('hydrateJobDetails rejects cancellation raised while the last detail request is resolving', async () => {
  const controller = new AbortController()

  await assert.rejects(
    hydrateJobDetails([
      { title: 'Only role', jobId: '1', sourceUrl: 'https://careers.hcltech.com/job/only/1-en_US/' },
    ], {
      signal: controller.signal,
      fetchDetail: async () => {
        controller.abort(new Error('runner stopped on last detail'))
        return readFixture('job-detail-116250.html')
      },
    }),
    /runner stopped on last detail/i,
  )
})

