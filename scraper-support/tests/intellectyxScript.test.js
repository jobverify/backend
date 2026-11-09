import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures/intellectyx',
)

const readHtmlFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const homepageHtml = readHtmlFixture('homepage.html')
const careersNoPublicJobsHtml = readHtmlFixture('careers-no-public-jobs.html')

const loadIntellectyxModule = async () => {
  try {
    return await import('../../scraper/intellectyx/script.js')
  } catch {
    assert.fail('Expected Intellectyx scraper module at ../../scraper/intellectyx/script.js')
  }
}

test('Intellectyx recognizes the verified official homepage and resume-only careers page', async () => {
  const intellectyx = await loadIntellectyxModule()
  const liveLikeHomepageHtml = homepageHtml.replace(/Exceptional Ideas/gi, 'Upcoming Webinar')
  const genericApplyCtaHtml = `${careersNoPublicJobsHtml}<section><a href="/contact">Apply Now</a></section>`

  assert.equal(intellectyx.SOURCE, 'intellectyx')
  assert.equal(intellectyx.COMPANY, 'Intellectyx')
  assert.equal(intellectyx.HOMEPAGE_URL, 'https://www.intellectyx.com/')
  assert.equal(intellectyx.CAREERS_URL, 'https://www.intellectyx.com/careers/')
  assert.equal(intellectyx.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(intellectyx.hasOfficialHomepageSignal(liveLikeHomepageHtml), true)
  assert.equal(intellectyx.hasOfficialCareersSignal(careersNoPublicJobsHtml), true)
  assert.equal(intellectyx.pageExposesPublicJobListings(careersNoPublicJobsHtml), false)
  assert.equal(intellectyx.pageExposesPublicJobListings(genericApplyCtaHtml), false)
  assert.equal(
    intellectyx.pageExposesPublicJobListings(
      `${careersNoPublicJobsHtml}<section><h2>Current Openings</h2><a href="/jobs/data-engineer">Apply Now</a></section>`,
    ),
    true,
  )
})

test('Intellectyx returns no jobs only while the verified official careers page remains resume-only', async () => {
  const intellectyx = await loadIntellectyxModule()
  const requestedUrls = []

  const jobs = await intellectyx.createIntellectyxScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === intellectyx.HOMEPAGE_URL) {
        return {
          ok: true,
          status: 200,
          url,
          text: homepageHtml,
        }
      }

      if (url === intellectyx.CAREERS_URL) {
        return {
          ok: true,
          status: 200,
          url,
          text: careersNoPublicJobsHtml,
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    intellectyx.HOMEPAGE_URL,
    intellectyx.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Intellectyx fails closed when the homepage or careers page contract changes', async () => {
  const intellectyx = await loadIntellectyxModule()

  await assert.rejects(
    intellectyx.createIntellectyxScraper().run({
      fetchPage: async (url) => ({
        ok: true,
        status: 200,
        url,
        text: url === intellectyx.HOMEPAGE_URL
          ? '<html><head><title>Placeholder</title></head><body>Welcome</body></html>'
          : careersNoPublicJobsHtml,
      }),
    }),
    /official Intellectyx homepage/i,
  )

  await assert.rejects(
    intellectyx.createIntellectyxScraper().run({
      fetchPage: async (url) => ({
        ok: true,
        status: 200,
        url,
        text: url === intellectyx.HOMEPAGE_URL ? homepageHtml : '<html><body><h1>Careers</h1></body></html>',
      }),
    }),
    /official Intellectyx careers page/i,
  )

  await assert.rejects(
    intellectyx.createIntellectyxScraper().run({
      fetchPage: async (url) => ({
        ok: true,
        status: 200,
        url,
        text: url === intellectyx.HOMEPAGE_URL
          ? homepageHtml
          : `${careersNoPublicJobsHtml}<section><h2>Open Positions</h2><a href="/jobs/data-engineer">Apply Now</a></section>`,
      }),
    }),
    /appears to expose public job listings/i,
  )
})
