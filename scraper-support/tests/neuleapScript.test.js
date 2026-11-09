import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'neuleap',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const homepageHtml = readFixture('homepage.html')
const careersPageBundleJs = readFixture('careers-page-bundle.js')

const loadNeuLeapModule = async () => {
  try {
    return await import('../../scraper/neuleap/script.js')
  } catch {
    assert.fail('Expected NeuLeap scraper module at ../../scraper/neuleap/script.js')
  }
}

test('NeuLeap sentinels recognize the verified homepage, inline careers surface, and first-party page bundle', async () => {
  const neuleap = await loadNeuLeapModule()

  assert.equal(neuleap.SOURCE, 'neuleap')
  assert.equal(neuleap.COMPANY, 'NeuLeap')
  assert.equal(neuleap.HOMEPAGE_URL, 'https://neuleap.ai/')
  assert.equal(neuleap.CAREERS_URL, 'https://neuleap.ai/#careers')
  assert.equal(neuleap.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(neuleap.hasOfficialCareersSignal(homepageHtml), true)
  assert.equal(
    neuleap.extractCareerBundleUrl(homepageHtml),
    'https://neuleap.ai/_next/static/chunks/app/page-0a39aa9318e4bddc.js',
  )
  assert.equal(neuleap.hasVerifiedCareerBundleSignal(careersPageBundleJs), true)
})

test('NeuLeap extracts the current structured first-party openings from the verified page bundle', async () => {
  const neuleap = await loadNeuLeapModule()

  const jobs = neuleap.extractBundleJobs(careersPageBundleJs)

  assert.equal(jobs.length, 8)
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Junior Data Engineer / Associate Data Engineer',
      'Data Engineer',
      'Senior Data Engineer',
      'Junior Generative AI Engineer',
      'Generative AI Engineer',
      'Senior Generative AI Engineer',
      'Chief Business Officer',
      'Office Administrative & HR Assistant',
    ],
  )
  assert.deepEqual(
    (({
      title,
      department,
      location,
      type,
      experience,
    }) => ({
      title,
      department,
      location,
      type,
      experience,
    }))(jobs[0]),
    {
      title: 'Junior Data Engineer / Associate Data Engineer',
      department: 'Engineering',
      location: 'Pune',
      type: 'Full-Time',
      experience: '0 - 2 Years Experience',
    },
  )
  assert.deepEqual(
    (({
      title,
      department,
      location,
      type,
      experience,
    }) => ({
      title,
      department,
      location,
      type,
      experience,
    }))(jobs[6]),
    {
      title: 'Chief Business Officer',
      department: null,
      location: 'Pune',
      type: 'Full-Time',
      experience: '12 - 18+ Years Experience',
    },
  )
})

test('NeuLeap run verifies the trusted homepage plus careers surface and returns normalized public openings', async () => {
  const neuleap = await loadNeuLeapModule()
  const requestedUrls = []

  const jobs = await neuleap.createNeuLeapScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === neuleap.HOMEPAGE_URL) return homepageHtml
      if (url === neuleap.CAREERS_URL) return homepageHtml
      if (url === 'https://neuleap.ai/_next/static/chunks/app/page-0a39aa9318e4bddc.js') {
        return careersPageBundleJs
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-11T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    neuleap.HOMEPAGE_URL,
    neuleap.CAREERS_URL,
    'https://neuleap.ai/_next/static/chunks/app/page-0a39aa9318e4bddc.js',
  ])
  assert.equal(jobs.length, 8)
  assert.deepEqual(
    (({
      title,
      department,
      location,
      city,
      country,
      source,
      sourceUrl,
      applyUrl,
      companyCareerPage,
      companyDomain,
      atsPlatform,
      employmentType,
      experienceRequired,
    }) => ({
      title,
      department,
      location,
      city,
      country,
      source,
      sourceUrl,
      applyUrl,
      companyCareerPage,
      companyDomain,
      atsPlatform,
      employmentType,
      experienceRequired,
    }))(jobs[0]),
    {
      title: 'Junior Data Engineer / Associate Data Engineer',
      department: 'Engineering',
      location: 'Pune',
      city: 'Pune',
      country: 'India',
      source: 'neuleap',
      sourceUrl: 'https://neuleap.ai/#careers',
      applyUrl: 'https://neuleap.ai/#careers',
      companyCareerPage: 'https://neuleap.ai/#careers',
      companyDomain: 'neuleap.ai',
      atsPlatform: 'official-company-careers',
      employmentType: 'Full-time',
      experienceRequired: '0 - 2 Years Experience',
    },
  )

  const cbo = jobs.find((job) => job.title === 'Chief Business Officer')
  assert.ok(cbo, 'Expected Chief Business Officer opening in normalized results')
  assert.equal(cbo.department, null)
  assert.equal(cbo.experienceRequired, '12 - 18+ Years Experience')
  assert.equal(cbo.location, 'Pune')

  assert.equal(jobs[0].scrapedTimestamp?.toISOString(), '2026-07-11T00:00:00.000Z')
})

test('NeuLeap fails closed when the verified homepage, inline careers surface, or page bundle drifts', async () => {
  const neuleap = await loadNeuLeapModule()

  await assert.rejects(
    neuleap.createNeuLeapScraper().run({
      fetchText: async (url) => {
        if (url === neuleap.HOMEPAGE_URL) {
          return homepageHtml.replace('AI-Powered Enterprise Transformation', 'Unexpected Placeholder')
        }

        if (url === neuleap.CAREERS_URL) return homepageHtml
        return careersPageBundleJs
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    neuleap.createNeuLeapScraper().run({
      fetchText: async (url) => {
        if (url === neuleap.HOMEPAGE_URL) return homepageHtml
        if (url === neuleap.CAREERS_URL) {
          return homepageHtml.replace('Open Positions', 'Career Opportunities')
        }

        return careersPageBundleJs
      },
    }),
    /verified public careers surface/i,
  )

  await assert.rejects(
    neuleap.createNeuLeapScraper().run({
      fetchText: async (url) => {
        if (url === neuleap.HOMEPAGE_URL || url === neuleap.CAREERS_URL) return homepageHtml
        return careersPageBundleJs.replace('/api/submit-application', '/api/contact-us')
      },
    }),
    /verified first-party page bundle/i,
  )
})
