import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, '../../scraper/feedbackinfrapvtltd/fixtures')

const loadFeedbackInfraModule = async () => {
  try {
    return await import('../../scraper/feedbackinfrapvtltd/script.js')
  } catch {
    assert.fail('Expected Feedback Infra Pvt Ltd scraper module at ../../scraper/feedbackinfrapvtltd/script.js')
  }
}

const readFixture = async (name) => readFile(path.join(fixturesDir, name), 'utf8')

test('Feedback Infra validates the verified official homepage and careers handoff before returning no first-party listings', async () => {
  const feedbackInfra = await loadFeedbackInfraModule()
  const homepageHtml = await readFixture('homepage.html')
  const careersHtml = await readFixture('careers.html')
  const requestedUrls = []

  assert.equal(feedbackInfra.SOURCE, 'feedbackinfrapvtltd')
  assert.equal(feedbackInfra.COMPANY, 'Feedback Infra Pvt Ltd')
  assert.equal(feedbackInfra.HOMEPAGE_URL, 'https://www.feedbackinfra.com/')
  assert.equal(feedbackInfra.CAREERS_URL, 'https://www.feedbackinfra.com/career.php')
  assert.equal(feedbackInfra.EXTERNAL_JOBS_HOST, 'companies.naukri.com')
  assert.equal(feedbackInfra.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(feedbackInfra.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(feedbackInfra.hasExternalJobsHandoffSignal(careersHtml), true)

  const jobs = await feedbackInfra.createFeedbackInfraScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === feedbackInfra.HOMEPAGE_URL) return homepageHtml
      if (url === feedbackInfra.CAREERS_URL) return careersHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.feedbackinfra.com/',
    'https://www.feedbackinfra.com/career.php',
  ])
  assert.deepEqual(jobs, [])
})

test('Feedback Infra fails closed when the verified homepage or careers handoff changes', async () => {
  const feedbackInfra = await loadFeedbackInfraModule()
  const careersHtml = await readFixture('careers.html')

  await assert.rejects(
    feedbackInfra.createFeedbackInfraScraper().run({
      fetchText: async (url) => {
        if (url === feedbackInfra.HOMEPAGE_URL) {
          return '<html><head><title>Unexpected</title></head><body>No brand markers</body></html>'
        }

        if (url === feedbackInfra.CAREERS_URL) {
          return careersHtml
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    feedbackInfra.createFeedbackInfraScraper().run({
      fetchText: async (url) => {
        if (url === feedbackInfra.HOMEPAGE_URL) {
          return await readFixture('homepage.html')
        }

        if (url === feedbackInfra.CAREERS_URL) {
          return `
            <!doctype html>
            <html lang="en">
              <head>
                <title>Feedback Infra | Making Infrastructure Happen</title>
              </head>
              <body>
                <h1>Careers</h1>
                <p>Life at Feedback</p>
                <p>Current Openings</p>
                <p>Feedback Infra on twitter</p>
                <p>inquiries@feedbackinfra.com</p>
              </body>
            </html>
          `
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers handoff/i,
  )
})
