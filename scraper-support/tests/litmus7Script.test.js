import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scraper/litmus7/fixtures',
)

const readHtmlFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const homepageHtml = readHtmlFixture('homepage.html')
const careersHtml = readHtmlFixture('career.html')

const loadLitmus7Module = async () => {
  try {
    return await import('../../scraper/litmus7/script.js')
  } catch {
    assert.fail('Expected Litmus7 scraper module at ../../scraper/litmus7/script.js')
  }
}

test('Litmus7 scraper constants stay pinned to the verified homepage and zero-job careers page', async () => {
  const litmus7 = await loadLitmus7Module()

  assert.equal(litmus7.SOURCE, 'litmus7')
  assert.equal(litmus7.COMPANY, 'Litmus7 Systems Consulting Ltd')
  assert.equal(litmus7.HOMEPAGE_URL, 'https://www.litmus7.com/')
  assert.equal(litmus7.CAREERS_URL, 'https://www.litmus7.com/Career')
  assert.equal(litmus7.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(litmus7.hasOfficialCareerSignal(careersHtml), true)
  assert.equal(litmus7.hasPublicJobsSignal(careersHtml), false)
  assert.equal(
    litmus7.hasPublicJobsSignal('<html><body><a href="/jobs/senior-engineer">Apply now</a></body></html>'),
    true,
  )
})

test('Litmus7 returns no jobs only while the verified first-party careers page says no open positions', async () => {
  const litmus7 = await loadLitmus7Module()
  const requestedUrls = []

  const jobs = await litmus7.createLitmus7Scraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === litmus7.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: homepageHtml,
        }
      }

      if (url === litmus7.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: careersHtml,
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    litmus7.HOMEPAGE_URL,
    litmus7.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Litmus7 fails closed when the homepage contract drifts or the careers page starts exposing jobs', async () => {
  const litmus7 = await loadLitmus7Module()

  await assert.rejects(
    litmus7.createLitmus7Scraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: url === litmus7.HOMEPAGE_URL ? '<html><body><h1>Unexpected homepage</h1></body></html>' : careersHtml,
      }),
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    litmus7.createLitmus7Scraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: url === litmus7.HOMEPAGE_URL
          ? homepageHtml
          : careersHtml.replace('No Open Positions', '<a href="/jobs/senior-engineer">Apply now</a>'),
      }),
    }),
    /public jobs surface/i,
  )

  await assert.rejects(
    litmus7.createLitmus7Scraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: url === litmus7.HOMEPAGE_URL ? homepageHtml : careersHtml.replace('Share your resume', 'Send us a note'),
      }),
    }),
    /verified first-party careers page/i,
  )
})
