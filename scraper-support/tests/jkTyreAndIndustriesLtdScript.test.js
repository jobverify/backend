import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'jktyreandindustriesltd',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readFixture('homepage.html')
const verifiedCareersHtml = readFixture('careers.html')
const verifiedCurrentOpeningsHtml = readFixture('current-openings.html')

const loadModule = async () => {
  try {
    return await import('../../scraper/jktyreandindustriesltd/script.js')
  } catch {
    assert.fail('Expected JK Tyre and Industries Ltd scraper module at ../../scraper/jktyreandindustriesltd/script.js')
  }
}

test('JK Tyre sentinels recognize the verified homepage, careers landing, and empty current openings page', async () => {
  const jkTyre = await loadModule()
  const liveLikeCareersHtml = verifiedCareersHtml
    .replace(/People marching miles seamlessly/gi, 'Join a Leader in Tyre Manufacturing')
    .replace(/Career by choice/gi, 'Why JK Tyre')
  const liveLikeCurrentOpeningsHtml = verifiedCurrentOpeningsHtml
    .replace('</body>', '<nav><a href="/career/jobs">Search Jobs</a><a href="/career/apply">Apply Now</a></nav></body>')

  assert.equal(jkTyre.SOURCE, 'jktyreandindustriesltd')
  assert.equal(jkTyre.COMPANY, 'JK Tyre and Industries Ltd')
  assert.equal(jkTyre.HOMEPAGE_URL, 'https://www.jktyre.com/')
  assert.equal(jkTyre.CAREERS_URL, 'https://www.jktyre.com/career')
  assert.equal(jkTyre.CURRENT_OPENINGS_URL, 'https://www.jktyre.com/career/jobs')
  assert.equal(jkTyre.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(jkTyre.hasOfficialCareersSignal(verifiedCareersHtml), true)
  assert.equal(jkTyre.hasOfficialCareersSignal(liveLikeCareersHtml), true)
  assert.equal(jkTyre.hasVerifiedEmptyCurrentOpeningsSignal(verifiedCurrentOpeningsHtml), true)
  assert.equal(jkTyre.hasVerifiedEmptyCurrentOpeningsSignal(liveLikeCurrentOpeningsHtml), true)
  assert.equal(jkTyre.hasPublicJobSignal(liveLikeCurrentOpeningsHtml), true)
})

test('JK Tyre returns no jobs while the verified first-party careers surface remains empty', async () => {
  const jkTyre = await loadModule()
  const requestedUrls = []

  const jobs = await jkTyre.createJkTyreAndIndustriesLtdScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === jkTyre.HOMEPAGE_URL) return verifiedHomepageHtml
      if (url === jkTyre.CAREERS_URL) return verifiedCareersHtml
      if (url === jkTyre.CURRENT_OPENINGS_URL) return verifiedCurrentOpeningsHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    jkTyre.HOMEPAGE_URL,
    jkTyre.CAREERS_URL,
    jkTyre.CURRENT_OPENINGS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('JK Tyre fails closed when the verified homepage, careers landing, or current openings contract changes', async () => {
  const jkTyre = await loadModule()

  await assert.rejects(
    jkTyre.createJkTyreAndIndustriesLtdScraper().run({
      fetchText: async (url) => {
        if (url === jkTyre.HOMEPAGE_URL) {
          return '<html><head><title>JK Tyre</title></head><body>Broken</body></html>'
        }

        if (url === jkTyre.CAREERS_URL) return verifiedCareersHtml
        return verifiedCurrentOpeningsHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    jkTyre.createJkTyreAndIndustriesLtdScraper().run({
      fetchText: async (url) => {
        if (url === jkTyre.HOMEPAGE_URL) return verifiedHomepageHtml

        if (url === jkTyre.CAREERS_URL) {
          return verifiedCareersHtml.replace('Current Openings', 'Open Positions')
        }

        return verifiedCurrentOpeningsHtml
      },
    }),
    /verified official careers landing/i,
  )

  await assert.rejects(
    jkTyre.createJkTyreAndIndustriesLtdScraper().run({
      fetchText: async (url) => {
        if (url === jkTyre.HOMEPAGE_URL) return verifiedHomepageHtml
        if (url === jkTyre.CAREERS_URL) return verifiedCareersHtml

        return verifiedCurrentOpeningsHtml.replace('No Jobs Found', 'Apply Now')
      },
    }),
    /public job listings/i,
  )
})
