import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scraper/jindalsteelandpower/fixtures',
)

const readHtmlFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const homepageHtml = readHtmlFixture('homepage.html')
const careersHtml = readHtmlFixture('career-opportunity.html')
const talentCommunityHtml = readHtmlFixture('join-our-talent-community.html')

const loadModule = async () => {
  try {
    return await import('../../scraper/jindalsteelandpower/script.js')
  } catch {
    assert.fail('Expected Jindal Steel and Power scraper module at ../../scraper/jindalsteelandpower/script.js')
  }
}

test('Jindal Steel and Power pins the verified first-party homepage and careers surfaces', async () => {
  const scraper = await loadModule()

  assert.equal(scraper.SOURCE, 'jindalsteelandpower')
  assert.equal(scraper.COMPANY, 'Jindal Steel and Power')
  assert.equal(scraper.HOMEPAGE_URL, 'https://www.jindalsteel.in/')
  assert.equal(scraper.CAREERS_URL, 'https://www.jindalsteel.in/career-opportunity')
  assert.equal(scraper.TALENT_COMMUNITY_URL, 'https://www.jindalsteel.in/join-our-talent-community')
  assert.equal(scraper.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(scraper.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(scraper.hasTalentCommunitySignal(talentCommunityHtml), true)
  assert.equal(scraper.pageExposesPublicJobListings(homepageHtml), false)
  assert.equal(scraper.pageExposesPublicJobListings(careersHtml), false)
  assert.equal(scraper.pageExposesPublicJobListings(talentCommunityHtml), false)
})

test('Jindal Steel and Power returns no jobs while the verified public career surface stays unchanged', async () => {
  const scraper = await loadModule()
  const requestedUrls = []

  const jobs = await scraper.createJindalSteelAndPowerScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === scraper.HOMEPAGE_URL) return homepageHtml
      if (url === scraper.CAREERS_URL) return careersHtml
      if (url === scraper.TALENT_COMMUNITY_URL) return talentCommunityHtml
      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    scraper.HOMEPAGE_URL,
    scraper.CAREERS_URL,
    scraper.TALENT_COMMUNITY_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Jindal Steel and Power fails closed when the verified homepage or careers contract changes', async () => {
  const scraper = await loadModule()

  await assert.rejects(
    scraper.createJindalSteelAndPowerScraper().run({
      fetchText: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return '<html><body><h1>Jindal Steel</h1></body></html>'
        }

        if (url === scraper.CAREERS_URL) return careersHtml
        if (url === scraper.TALENT_COMMUNITY_URL) return talentCommunityHtml
        throw new Error(`Unexpected fixture URL: ${url}`)
      },
    }),
    /official homepage changed/i,
  )

  await assert.rejects(
    scraper.createJindalSteelAndPowerScraper().run({
      fetchText: async (url) => {
        if (url === scraper.HOMEPAGE_URL) return homepageHtml
        if (url === scraper.CAREERS_URL) {
          return `${careersHtml}<a href="https://job-boards.greenhouse.io/jindalsteel/jobs/123">Apply now</a>`
        }
        if (url === scraper.TALENT_COMMUNITY_URL) return talentCommunityHtml
        throw new Error(`Unexpected fixture URL: ${url}`)
      },
    }),
    /now appears to expose public job listings/i,
  )
})
