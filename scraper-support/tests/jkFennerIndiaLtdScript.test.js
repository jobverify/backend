import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'jkfennerindialtd',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const loadModule = async () => {
  try {
    return await import('../../scraper/jkfennerindialtd/script.js')
  } catch {
    assert.fail('Expected J.K.Fenner India Ltd scraper module at ../../scraper/jkfennerindialtd/script.js')
  }
}

test('J.K.Fenner India Ltd validates the verified homepage and first-party careers table', async () => {
  const jkFenner = await loadModule()
  const homepageHtml = readFixture('homepage.html')
  const careersHtml = readFixture('career-list.html')
  const liveLikeCareersHtml = careersHtml
    .replace(/<link rel="canonical"[^>]+>/i, '')
    .replaceAll('https://jkfenner.com/job-openings/', '/job-openings/')

  assert.equal(jkFenner.SOURCE, 'jkfennerindialtd')
  assert.equal(jkFenner.COMPANY, 'J.K.Fenner India Ltd')
  assert.equal(jkFenner.HOMEPAGE_URL, 'https://jkfenner.com/')
  assert.equal(jkFenner.CAREERS_URL, 'https://jkfenner.com/career-list/')
  assert.equal(jkFenner.JOB_OPENINGS_URL, 'https://jkfenner.com/job-openings/')
  assert.equal(jkFenner.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(jkFenner.hasCareerListSignal(careersHtml), true)
  assert.equal(jkFenner.hasCareerListSignal(liveLikeCareersHtml), true)

  const jobs = jkFenner.extractOpenPositions(careersHtml)
  assert.equal(jobs.length, 8)
  assert.deepEqual(jobs[0], {
    title: 'Assistant Manager – Gear Box',
    location: 'Odisha, Mumbai, Raipur, India',
    city: null,
    state: null,
    jobId: 'jkfennerindialtd-assistant-manager-gear-box-odisha-mumbai-raipur',
    requisitionId: 'jkfennerindialtd-assistant-manager-gear-box-odisha-mumbai-raipur',
    employmentType: 'Full-time',
    experienceRequired: '05 – 08 Years',
    minimumQualification: 'B E/B Tech',
    preferredQualification: null,
    department: 'Sales Engineer',
    jobDescription: 'Customer segments handled: Power, Steel, Cement, Sugar, Paper, Food & Beverage Product Experience: Industrial Gear Box / Geared Motors',
    sourceUrl: 'https://jkfenner.com/career-list/',
    applyUrl: 'https://jkfenner.com/job-openings/',
    link: 'https://jkfenner.com/job-openings/',
  })
})

test('J.K.Fenner India Ltd returns the verified openings and only requests the official homepage and careers page', async () => {
  const jkFenner = await loadModule()
  const requestedUrls = []

  const jobs = await jkFenner.createJkFennerIndiaLtdScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === jkFenner.HOMEPAGE_URL) {
        return readFixture('homepage.html')
      }

      if (url === jkFenner.CAREERS_URL) {
        return readFixture('career-list.html')
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [jkFenner.HOMEPAGE_URL, jkFenner.CAREERS_URL])
  assert.equal(jobs.length, 8)
  assert.equal(jobs[7].title, 'Deputy Manager / ManagerOE')
  assert.equal(jobs[7].applyUrl, 'https://jkfenner.com/job-openings/')
})

test('J.K.Fenner India Ltd fails closed when the homepage or careers table changes materially', async () => {
  const jkFenner = await loadModule()

  await assert.rejects(
    jkFenner.createJkFennerIndiaLtdScraper().run({
      fetchText: async (url) => {
        if (url === jkFenner.HOMEPAGE_URL) {
          return '<html><head><title>Unexpected</title></head><body></body></html>'
        }

        return readFixture('career-list.html')
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    jkFenner.createJkFennerIndiaLtdScraper().run({
      fetchText: async (url) => {
        if (url === jkFenner.HOMEPAGE_URL) {
          return readFixture('homepage.html')
        }

        return readFixture('career-list.html').replace('Open Positions', 'Open Roles')
      },
    }),
    /verified careers table/i,
  )
})
