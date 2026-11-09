import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadKirloskarModule = async () => {
  try {
    return await import('../../scraper/kirloskarbrothersltd/script.js')
  } catch {
    assert.fail('Expected Kirloskar Brothers Ltd scraper module at ../../scraper/kirloskarbrothersltd/script.js')
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures', 'kirloskarbrothersltd')

const homepageHtml = readFileSync(path.join(fixturesDir, 'homepage.html'), 'utf8')
const careersHtml = readFileSync(path.join(fixturesDir, 'careers.html'), 'utf8')

test('Kirloskar Brothers Ltd scraper pins the verified first-party homepage and resume-only careers signals', async () => {
  const kirloskar = await loadKirloskarModule()

  assert.equal(kirloskar.SOURCE, 'kirloskarbrothersltd')
  assert.equal(kirloskar.COMPANY, 'Kirloskar Brothers Ltd')
  assert.equal(kirloskar.HOMEPAGE_URL, 'https://www.kirloskarpumps.com/')
  assert.equal(kirloskar.CAREERS_URL, 'https://www.kirloskarpumps.com/careers/')
  assert.equal(kirloskar.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(kirloskar.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(kirloskar.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(kirloskar.hasPublicJobsSignal(careersHtml), false)
  assert.equal(kirloskar.hasResumeOnlySignal(careersHtml), true)
})

test('Kirloskar Brothers Ltd scraper returns no jobs while the verified first-party careers page remains resume-only', async () => {
  const kirloskar = await loadKirloskarModule()
  const requestedUrls = []

  const jobs = await kirloskar.createKirloskarBrothersLtdScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === kirloskar.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === kirloskar.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [kirloskar.HOMEPAGE_URL, kirloskar.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Kirloskar Brothers Ltd scraper fails closed when the verified homepage or careers surface drifts', async () => {
  const kirloskar = await loadKirloskarModule()

  await assert.rejects(
    kirloskar.createKirloskarBrothersLtdScraper().run({
      fetchPage: async (url) => {
        if (url === kirloskar.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body>Unexpected homepage</body></html>' }
        }

        if (url === kirloskar.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    kirloskar.createKirloskarBrothersLtdScraper().run({
      fetchPage: async (url) => {
        if (url === kirloskar.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === kirloskar.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersHtml.replace(
              '<input type="submit" value="Send" />',
              '<a href="https://jobs.example.com/software-engineer">Apply now</a>',
            ),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public jobs surface|resume-only surface/i,
  )
})
