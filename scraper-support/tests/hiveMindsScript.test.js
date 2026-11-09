import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'scraper',
  'hiveminds',
  'fixtures',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')
const readJsonFixture = (name) => JSON.parse(readFixture(name))

const homepageHtml = readFixture('homepage.html')
const careersHtml = readFixture('careers.html')
const careersBundleJs = readFixture('careers-page.js')
const activeJobsPayload = readJsonFixture('active-jobs.json')

const loadModule = async () => import('../../scraper/hiveminds/script.js')

test('HiveMinds verifies the official homepage and extracts the first-party Keka jobs config from the careers surface', async () => {
  const hiveminds = await loadModule()

  assert.equal(hiveminds.SOURCE, 'hiveminds')
  assert.equal(hiveminds.COMPANY, 'HiveMinds')
  assert.equal(hiveminds.HOMEPAGE_URL, 'https://www.hiveminds.in/')
  assert.equal(hiveminds.CAREERS_URL, 'https://www.hiveminds.in/careers')
  assert.equal(hiveminds.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hiveminds.hasVerifiedCareersPageSignal(careersHtml), true)
  assert.equal(
    hiveminds.extractCareersBundlePath(careersHtml),
    '/_next/static/chunks/pages/careers-61518bb8bd99f33b.js?dpl=dpl_EhLuoRXY2NmsfPb6kPYVascu2PvR',
  )
  assert.deepEqual(
    hiveminds.extractCareerConfig(careersBundleJs),
    {
      identifier: 'ba2656db-0fdb-4859-a652-f6eec08f8d7e',
      domain: 'https://hiveminds.keka.com/careers/',
      portalName: 'default',
    },
  )
  assert.equal(
    hiveminds.buildActiveJobsUrl(hiveminds.extractCareerConfig(careersBundleJs)),
    'https://hiveminds.keka.com/careers/api/embedjobs/default/active/ba2656db-0fdb-4859-a652-f6eec08f8d7e',
  )
})

test('HiveMinds keeps only India jobs from the verified Keka feed and decorates runner output', async () => {
  const hiveminds = await loadModule()

  const extractedJobs = hiveminds.extractSearchResults(activeJobsPayload, {
    domain: 'https://hiveminds.keka.com/careers/',
  })

  assert.equal(extractedJobs.length, 1)
  assert.deepEqual(extractedJobs[0], {
    title: 'Motion Graphics Design Specialist',
    company: 'HiveMinds',
    department: 'Creative',
    location: 'Bengaluru, KA, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '149307',
    requisitionId: '149307',
    sourceUrl: 'https://hiveminds.keka.com/careers/jobdetails/149307',
    applyUrl: 'https://hiveminds.keka.com/careers/jobdetails/149307',
    employmentType: 'Full Time',
    experienceRequired: '2+ years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Creativity / Innovation', 'Motion Graphics', 'google Ads'],
    postingDate: '2026-07-02',
    closingDate: null,
    jobDescription: 'Job Description Experience: 2 + Years Location: Bengaluru (Work from Office) We are looking for a creative and performance-driven Motion Graphics Designer to join our team.',
  })

  const requestedTexts = []
  const requestedJson = []
  const jobs = await hiveminds.createHiveMindsScraper().run({
    fetchText: async (url) => {
      requestedTexts.push(url)

      if (url === hiveminds.HOMEPAGE_URL) return homepageHtml
      if (url === hiveminds.CAREERS_URL) return careersHtml
      if (url === 'https://www.hiveminds.in/_next/static/chunks/pages/careers-61518bb8bd99f33b.js?dpl=dpl_EhLuoRXY2NmsfPb6kPYVascu2PvR') {
        return careersBundleJs
      }

      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)

      if (url === 'https://hiveminds.keka.com/careers/api/embedjobs/default/active/ba2656db-0fdb-4859-a652-f6eec08f8d7e') {
        return activeJobsPayload
      }

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTexts, [
    hiveminds.HOMEPAGE_URL,
    hiveminds.CAREERS_URL,
    'https://www.hiveminds.in/_next/static/chunks/pages/careers-61518bb8bd99f33b.js?dpl=dpl_EhLuoRXY2NmsfPb6kPYVascu2PvR',
  ])
  assert.deepEqual(requestedJson, [
    'https://hiveminds.keka.com/careers/api/embedjobs/default/active/ba2656db-0fdb-4859-a652-f6eec08f8d7e',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'hiveminds')
  assert.equal(jobs[0].link, 'https://hiveminds.keka.com/careers/jobdetails/149307')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
