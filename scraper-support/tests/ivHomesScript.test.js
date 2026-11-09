import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'ivhomes',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const homepageHtml = readFixture('homepage.html')
const hiringHtml = readFixture('hiring.html')

const loadIvHomesModule = async () => {
  try {
    return await import('../../scraper/ivhomes/script.js')
  } catch {
    assert.fail('Expected Iv Homes scraper module at ../../scraper/ivhomes/script.js')
  }
}

test('Iv Homes sentinels recognize the verified homepage and first-party hiring page', async () => {
  const ivHomes = await loadIvHomesModule()

  assert.equal(ivHomes.SOURCE, 'ivhomes')
  assert.equal(ivHomes.COMPANY, 'Iv Homes')
  assert.equal(ivHomes.HOMEPAGE_URL, 'https://ivhomes.in/')
  assert.equal(ivHomes.CAREERS_URL, 'https://ivhomes.in/hiring/')
  assert.equal(ivHomes.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(ivHomes.hasOfficialHiringSignal(hiringHtml), true)
})

test('Iv Homes extracts the verified first-party hiring openings from the official page', async () => {
  const ivHomes = await loadIvHomesModule()

  const openings = ivHomes.extractJobOpenings(hiringHtml)

  assert.equal(openings.length, 12)
  assert.deepEqual(
    (({
      title,
      location,
      city,
      experienceRequired,
      jobId,
      requisitionId,
      sourceUrl,
      applyUrl,
      department,
      minimumQualification,
      requiredSkills,
    }) => ({
      title,
      location,
      city,
      experienceRequired,
      jobId,
      requisitionId,
      sourceUrl,
      applyUrl,
      department,
      minimumQualification,
      requiredSkills,
    }))(openings[0]),
    {
      title: 'Sales Manager - 3 Positions',
      location: 'Bangalore, Chennai, Hyderabad, India',
      city: null,
      experienceRequired: '6+ years',
      jobId: 'sales-manager-3-positions',
      requisitionId: 'sales-manager-3-positions',
      sourceUrl: 'https://ivhomes.in/hiring/',
      applyUrl: null,
      department: 'Sales Manager - 3 Positions',
      minimumQualification: 'MBA in Sales/Marketing or related field. Proven track record of achieving sales targets. Strong leadership and communication skills.',
      requiredSkills: [],
    },
  )

  assert.equal(openings[7].title, 'Channel Sales JD')
  assert.equal(openings[8].title, 'Guest Relationship Executive')
  assert.equal(openings[11].title, 'Business Analyst - Manager')
})

test('Iv Homes normalizes the first-party hiring opening into the shared scraper contract', async () => {
  const ivHomes = await loadIvHomesModule()

  const opening = ivHomes.extractJobOpenings(hiringHtml)[0]
  const normalized = normalizeScrapedJob(opening, {
    source: 'ivhomes',
    companyName: 'Iv Homes',
    companyCareerPage: 'https://ivhomes.in/hiring/',
    atsPlatform: 'official-company-careers',
  })

  assert.equal(normalized.company, 'Iv Homes')
  assert.equal(normalized.country, 'India')
  assert.equal(normalized.remoteStatus, 'On-site')
  assert.equal(normalized.jobType, 'Full-time Experienced')
})

test('Iv Homes run fetches the verified homepage and hiring page and returns the extracted openings', async () => {
  const ivHomes = await loadIvHomesModule()
  const requestedUrls = []

  const jobs = await ivHomes.createIvHomesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === ivHomes.HOMEPAGE_URL) return homepageHtml
      if (url === ivHomes.CAREERS_URL) return hiringHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    ivHomes.HOMEPAGE_URL,
    ivHomes.CAREERS_URL,
  ])
  assert.equal(jobs.length, 12)
  assert.equal(jobs[0].company, 'Iv Homes')
  assert.equal(jobs[0].source, 'ivhomes')
  assert.equal(jobs[0].link, 'https://ivhomes.in/hiring/')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('Iv Homes fails closed when the verified homepage or hiring page contract changes', async () => {
  const ivHomes = await loadIvHomesModule()

  await assert.rejects(
    ivHomes.createIvHomesScraper().run({
      fetchText: async (url) => {
        if (url === ivHomes.HOMEPAGE_URL) {
          return homepageHtml.replace('href="/hiring/"', 'href="/about/"')
        }

        return hiringHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    ivHomes.createIvHomesScraper().run({
      fetchText: async (url) => {
        if (url === ivHomes.HOMEPAGE_URL) return homepageHtml
        if (url === ivHomes.CAREERS_URL) return '<html><body><h1>Hiring</h1></body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified first-party hiring page/i,
  )
})
