import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

const loadArmstrongModule = async () => {
  try {
    return await import('../../scraper/armstrongfluidtechnology/script.js')
  } catch {
    return null
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'armstrongfluidtechnology',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildCareersPageUrl and buildJobDetailUrl keep Armstrong listings on the public careers site', async () => {
  const armstrong = await loadArmstrongModule()
  assert.ok(armstrong)

  assert.equal(
    armstrong.buildCareersPageUrl(),
    'https://armstrongfluidtechnology.com/en/about-armstrong/careers',
  )
  assert.equal(
    armstrong.buildJobDetailUrl('Sales-Manager-Retrofit-Northern-Region-Bengaluru-Karnataka'),
    'https://armstrongfluidtechnology.com/en/about-armstrong/careers/careers/Sales-Manager-Retrofit-Northern-Region-Bengaluru-Karnataka',
  )
})

test('extractListingSummary reads the India count from the Armstrong public careers page', async () => {
  const armstrong = await loadArmstrongModule()
  assert.ok(armstrong)

  const summary = armstrong.extractListingSummary(readFixture('careers.html'))
  assert.deepEqual(summary, {
    totalCount: 1,
  })
})

test('extractListings keeps only Armstrong India cards and maps them into the shared listing contract', async () => {
  const armstrong = await loadArmstrongModule()
  assert.ok(armstrong)

  const jobs = armstrong.extractListings(readFixture('careers.html'))

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Sales Manager - Retrofit-Northern Region',
    company: 'Armstrong Fluid Technology',
    department: null,
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'Sales-Manager-Retrofit-Northern-Region-Bengaluru-Karnataka',
    requisitionId: 'Sales-Manager-Retrofit-Northern-Region-Bengaluru-Karnataka',
    sourceUrl: 'https://armstrongfluidtechnology.com/en/about-armstrong/careers/careers/Sales-Manager-Retrofit-Northern-Region-Bengaluru-Karnataka',
    applyUrl: 'https://armstrongfluidtechnology.bamboohr.com/careers/401?source=aWQ9OA%3D%3D',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2025-08-01',
    closingDate: null,
    jobDescription: 'The Sales Manager - Retrofit-Northern Region provides Energy Upgrade business to North region located in Delhi.',
  })
})

test('normalizeScrapedJob composes Armstrong India sales roles from the public careers listing contract', async () => {
  const armstrong = await loadArmstrongModule()
  assert.ok(armstrong)

  const normalized = normalizeScrapedJob(
    armstrong.extractListings(readFixture('careers.html'))[0],
    {
      source: 'armstrongfluidtechnology',
      companyName: 'Armstrong Fluid Technology',
      companyCareerPage: 'https://armstrongfluidtechnology.com/en/about-armstrong/careers',
      atsPlatform: 'official-company-careers',
    },
  )

  assert.equal(normalized.company, 'Armstrong Fluid Technology')
  assert.equal(normalized.country, 'India')
  assert.equal(normalized.remoteStatus, 'On-site')
  assert.equal(normalized.experienceLevel, 'Senior Level')
  assert.equal(normalized.jobType, 'Full-time Experienced')
})

test('run follows the current official BambooHR handoff and decorates all full India details', async () => {
  const armstrong = await loadArmstrongModule()
  assert.ok(armstrong)

  const requests = []
  const scraper = armstrong.createArmstrongFluidTechnologyScraper()
  const native = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/armstrongfluidtechnology/test-data/native-20261103.json.gz', import.meta.url))))

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === armstrong.buildCareersPageUrl()) return native.company
      if (url === 'https://armstrongfluidtechnology.bamboohr.com/careers/') return native.board
      throw new Error(`Unexpected Armstrong URL: ${url}`)
    },
    fetchJson: async url => {
      requests.push(url)
      if (url.endsWith('/careers/list')) return structuredClone(native.listing)
      const detail = native.details.find(row => row.url === url)
      assert.ok(detail, url)
      return structuredClone(detail.body)
    },
  })

  assert.equal(requests.length, 164)
  assert.equal(jobs.length, 34)
  assert.equal(jobs[0].source, 'armstrongfluidtechnology')
  assert.equal(jobs[0].company, 'Armstrong Fluid Technology')
  assert.equal(jobs[0].jobId, '588')
  assert.equal(
    jobs[0].applyUrl,
    'https://armstrongfluidtechnology.bamboohr.com/careers/588',
  )
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
