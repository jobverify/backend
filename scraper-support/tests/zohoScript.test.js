import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadZohoModule = async () => {
  try {
    return await import('../../scraper/zoho/script.js')
  } catch {
    assert.fail('Expected Zoho scraper module at ../../scraper/scraper/zoho/script.js')
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'zoho',
)

const readJsonFixture = (name) => JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

test('buildApiUrl keeps Zoho on the first-party public Recruit feed', async () => {
  const { API_URL, buildApiUrl } = await loadZohoModule()
  assert.equal(buildApiUrl(), API_URL)
  assert.equal(
    API_URL,
    'https://careers.zohocorp.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite&extra_fields=%5B%22Remote_Job%22%5D',
  )
})

test('extractSearchResults keeps only India jobs from the Zoho public Recruit feed', async () => {
  const { extractSearchResults } = await loadZohoModule()
  const payload = readJsonFixture('public-job-openings.json')
  const jobs = extractSearchResults(payload)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Technical Support Engineers',
    company: 'Zoho',
    department: null,
    location: 'India',
    city: null,
    jobId: '193779000024445975',
    requisitionId: '193779000024445975',
    sourceUrl: 'https://careers.zohocorp.com/jobs/Careers/193779000024445975/Technical-Support-Engineers?source=CareerSite',
    applyUrl: 'https://careers.zohocorp.com/jobs/Careers/193779000024445975/Technical-Support-Engineers?source=CareerSite',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Provide voice-based support to international/domestic customers over the phone (Inbound and Outbound). Build a rapport with customers with clear and concise communication.',
  })
  assert.deepEqual(jobs[1], {
    title: 'Sales Executives',
    company: 'Zoho',
    department: null,
    location: 'India',
    city: null,
    jobId: '193779000024446028',
    requisitionId: '193779000024446028',
    sourceUrl: 'https://careers.zohocorp.com/jobs/Careers/193779000024446028/Sales-Executives?source=CareerSite',
    applyUrl: 'https://careers.zohocorp.com/jobs/Careers/193779000024446028/Sales-Executives?source=CareerSite',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Build rapport with contacts and understand where the prospect is in the buying process. Identify opportunities that meet a minimum qualification criteria.',
  })
})

test('run fetches Zoho public job openings and decorates shared runner fields', async () => {
  const { API_URL, createZohoScraper } = await loadZohoModule()
  const payload = readJsonFixture('public-job-openings.json')
  const requests = []
  const scraper = createZohoScraper({ maxJobs: 1 })

  const jobs = await scraper.run({
    fetchJson: async (url) => {
      requests.push(url)
      if (url === API_URL) return payload
      throw new Error(`Unexpected Zoho URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [API_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'zoho')
  assert.equal(jobs[0].company, 'Zoho')
  assert.equal(jobs[0].link, 'https://careers.zohocorp.com/jobs/Careers/193779000024445975/Technical-Support-Engineers?source=CareerSite')
  assert.equal(jobs[0].employmentType, 'Full-time')
})
