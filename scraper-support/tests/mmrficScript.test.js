import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'mmrfic',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const loadMMRFICModule = async () => {
  try {
    return await import('../../scraper/mmrfic/script.js')
  } catch {
    assert.fail('Expected MMRFIC scraper module at ../../scraper/mmrfic/script.js')
  }
}

const verifiedHomepageHtml = readFixture('homepage.html')
const verifiedCareersHtml = readFixture('careers.html')
const currentCareersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers &#8211; MMRFIC</title>
    </head>
    <body>
      <main>
        <h1>Careers</h1>
        <p>At MMRFIC, we don't just manufacture precision components - we build careers that thrive on purpose, innovation, and integrity.</p>
        <p>If you're driven by curiosity, like to be a part of a collaborative team, and seek opportunities to grow and make an impact - we invite you to explore a future with us.</p>
        <p>We're looking for passionate individuals to join us on this journey.</p>
        <p>At the heart of MMRFIC lies a vibrant and progressive culture built on values that power our growth and define our success.</p>
      </main>
    </body>
  </html>
`

test('MMRFIC recognizes the verified homepage and careers surface', async () => {
  const mmrfic = await loadMMRFICModule()

  assert.equal(mmrfic.SOURCE, 'mmrfic')
  assert.equal(mmrfic.COMPANY, 'MMRFIC')
  assert.equal(mmrfic.HOMEPAGE_URL, 'https://mmrfic.com/')
  assert.equal(mmrfic.CAREERS_URL, 'https://mmrfic.com/careers/')
  assert.equal(mmrfic.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(mmrfic.hasOfficialCareersSignal(verifiedCareersHtml), true)
  assert.equal(mmrfic.hasPublicJobsSignal(verifiedHomepageHtml), false)
  assert.equal(mmrfic.hasPublicJobsSignal(verifiedCareersHtml), false)
})

test('MMRFIC accepts the current first-party careers copy and title', async () => {
  const mmrfic = await loadMMRFICModule()

  assert.equal(mmrfic.hasOfficialCareersSignal(currentCareersHtml), true)
  assert.equal(mmrfic.hasPublicJobsSignal(currentCareersHtml), false)
})

test('MMRFIC returns no jobs while the verified homepage and careers page stay unchanged', async () => {
  const mmrfic = await loadMMRFICModule()
  const requestedUrls = []

  const jobs = await mmrfic.createMMRFICScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === mmrfic.HOMEPAGE_URL) {
        return verifiedHomepageHtml
      }

      if (url === mmrfic.CAREERS_URL) {
        return verifiedCareersHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [mmrfic.HOMEPAGE_URL, mmrfic.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

