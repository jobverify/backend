import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'ihxprivatelimited',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readFixture('homepage.html')
const firstPartyJobsHtml = readFixture('homepage-first-party-jobs.html')

const loadIhxPrivateLimitedModule = async () => {
  try {
    return await import('../../scraper/ihxprivatelimited/script.js')
  } catch {
    assert.fail('Expected IHX Private Limited scraper module at ../../scraper/ihxprivatelimited/script.js')
  }
}

test('IHX Private Limited scraper validates the verified first-party careers section and LinkedIn-only handoff', async () => {
  const ihx = await loadIhxPrivateLimitedModule()

  assert.equal(ihx.SOURCE, 'ihxprivatelimited')
  assert.equal(ihx.COMPANY, 'IHX Private Limited')
  assert.equal(ihx.HOMEPAGE_URL, 'https://www.ihx.in/')
  assert.equal(
    ihx.VERIFIED_LINKEDIN_JOBS_URL,
    'https://www.linkedin.com/company/ihx-india/jobs/',
  )
  assert.equal(ihx.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(
    ihx.extractExploreOpportunitiesUrl(verifiedHomepageHtml),
    'https://www.linkedin.com/company/ihx-india/jobs/',
  )
  assert.equal(ihx.pageExposesFirstPartyJobRecords(verifiedHomepageHtml), false)

  const requestedUrls = []
  const jobs = await ihx.createIhxPrivateLimitedScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === ihx.HOMEPAGE_URL) return verifiedHomepageHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [ihx.HOMEPAGE_URL])
  assert.deepEqual(jobs, [])
})

test('IHX Private Limited scraper fails closed when the careers handoff changes or first-party public jobs appear', async () => {
  const ihx = await loadIhxPrivateLimitedModule()

  await assert.rejects(
    ihx.createIhxPrivateLimitedScraper().run({
      fetchText: async (url) => {
        if (url === ihx.HOMEPAGE_URL) {
          return verifiedHomepageHtml.replace(
            'https://www.linkedin.com/company/ihx-india/jobs/',
            'https://jobs.ihx.in/openings',
          )
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified linkedin handoff/i,
  )

  await assert.rejects(
    ihx.createIhxPrivateLimitedScraper().run({
      fetchText: async (url) => {
        if (url === ihx.HOMEPAGE_URL) return firstPartyJobsHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /first-party public job records/i,
  )
})
