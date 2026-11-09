import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scraper/montraelectric/fixtures',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const HOMEPAGE_HTML = readFixture('homepage.html')
const CAREERS_HTML = readFixture('life-montra.html')

const loadMontraElectricModule = async () => {
  try {
    return await import('../../scraper/montraelectric/script.js')
  } catch {
    assert.fail('Expected MONTRA ELECTRIC scraper module at ../../scraper/montraelectric/script.js')
  }
}

test('MONTRA ELECTRIC validates the verified homepage and first-party careers surface', async () => {
  const montraElectric = await loadMontraElectricModule()

  assert.equal(montraElectric.SOURCE, 'montraelectric')
  assert.equal(montraElectric.COMPANY, 'MONTRA ELECTRIC')
  assert.equal(montraElectric.HOMEPAGE_URL, 'https://www.montraelectric.com/')
  assert.equal(montraElectric.CAREERS_URL, 'https://www.montraelectric.com/life-montra')
  assert.equal(montraElectric.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(montraElectric.hasOfficialCareersSignal(CAREERS_HTML), true)
})

test('MONTRA ELECTRIC extracts the verified first-party openings from the official page', async () => {
  const montraElectric = await loadMontraElectricModule()

  const jobs = montraElectric.extractPublicListings(CAREERS_HTML)

  assert.equal(jobs.length, 6)
  assert.deepEqual(jobs[0], {
    title: 'Territory Manager Sales',
    company: 'MONTRA ELECTRIC',
    department: 'Sales',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'montraelectric-territory-manager-sales-bengaluru-1',
    requisitionId: 'montraelectric-territory-manager-sales-bengaluru-1',
    sourceUrl: 'https://www.montraelectric.com/life-montra',
    applyUrl: null,
    employmentType: null,
    experienceRequired: '5-8 years',
    minimumQualification: 'Btech/MBA',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Function: Sales | Designation: 5-8 years | Experience: Btech/MBA | Location: Bengaluru',
  })
  assert.equal(jobs[1].location, 'Madhya Pradesh, India')
  assert.equal(jobs[1].city, null)
  assert.equal(jobs[5].title, 'Manager-Axle')
  assert.equal(jobs[5].department, 'R&D')
})

test('MONTRA ELECTRIC run fetches the verified homepage and careers page and returns the extracted openings', async () => {
  const montraElectric = await loadMontraElectricModule()
  const requestedUrls = []

  const jobs = await montraElectric.createMontraElectricScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === montraElectric.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === montraElectric.CAREERS_URL) return CAREERS_HTML

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-10T10:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    montraElectric.HOMEPAGE_URL,
    montraElectric.CAREERS_URL,
  ])
  assert.equal(jobs.length, 6)
  assert.equal(jobs[0].company, 'MONTRA ELECTRIC')
  assert.equal(jobs[0].source, 'montraelectric')
  assert.equal(jobs[0].link, montraElectric.CAREERS_URL)
  assert.equal(jobs[0].scrapedAt, '2026-07-10T10:00:00.000Z')
})

test('MONTRA ELECTRIC fails closed when the verified homepage or careers page contract changes', async () => {
  const montraElectric = await loadMontraElectricModule()

  await assert.rejects(
    montraElectric.createMontraElectricScraper().run({
      fetchText: async (url) => {
        if (url === montraElectric.HOMEPAGE_URL) {
          return '<html><body><h1>Unexpected homepage</h1></body></html>'
        }

        return CAREERS_HTML
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    montraElectric.createMontraElectricScraper().run({
      fetchText: async (url) => {
        if (url === montraElectric.HOMEPAGE_URL) return HOMEPAGE_HTML
        return '<html><body><h1>Current Openings</h1><p>No listings</p></body></html>'
      },
    }),
    /verified first-party careers surface/i,
  )
})
