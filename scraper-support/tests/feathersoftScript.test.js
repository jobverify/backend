import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.resolve(currentDir, '../../scraper/feathersoft/fixtures')

const loadFixture = (name) =>
  readFileSync(path.join(fixturesDir, name), 'utf8')

const loadFeathersoftModule = async () => {
  try {
    return await import('../../scraper/feathersoft/script.js')
  } catch {
    assert.fail('Expected Feathersoft scraper module at ../../scraper/feathersoft/script.js')
  }
}

const homepageHtml = loadFixture('homepage.html')
const emptyCareersHtml = loadFixture('careers-empty.html')
const careersWithPublicJobsHtml = loadFixture('careers-with-public-jobs.html')

test('Feathersoft validates the verified homepage handoff and empty first-party careers shell', async () => {
  const feathersoft = await loadFeathersoftModule()

  assert.equal(feathersoft.SOURCE, 'feathersoft')
  assert.equal(feathersoft.COMPANY, 'Feathersoft')
  assert.equal(feathersoft.HOMEPAGE_URL, 'https://www.feathersoft.com/')
  assert.equal(feathersoft.CAREERS_URL, 'https://www.feathersoft.com/careers/')
  assert.equal(feathersoft.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(feathersoft.hasOfficialCareersSignal(emptyCareersHtml), true)
  assert.equal(feathersoft.hasPublicJobBoardSignal(emptyCareersHtml), false)
  assert.equal(
    feathersoft.hasPublicJobBoardSignal('<html><body><label for="Job Title">Job Title</label></body></html>'),
    false,
  )
  assert.equal(
    feathersoft.hasPublicJobBoardSignal('<html><body><a href="/careers/senior-data-engineer/">Senior Data Engineer</a></body></html>'),
    true,
  )
  assert.equal(feathersoft.hasPublicJobBoardSignal(careersWithPublicJobsHtml), true)
})

test('Feathersoft returns no jobs while the official first-party careers page remains a verified empty shell', async () => {
  const feathersoft = await loadFeathersoftModule()
  const requestedUrls = []

  const jobs = await feathersoft.createFeathersoftScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === feathersoft.HOMEPAGE_URL) return homepageHtml
      if (url === feathersoft.CAREERS_URL) return emptyCareersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    feathersoft.HOMEPAGE_URL,
    feathersoft.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Feathersoft returns no jobs when the careers route serves the verified official homepage shell', async () => {
  const feathersoft = await loadFeathersoftModule()

  const jobs = await feathersoft.createFeathersoftScraper().run({
    fetchText: async (url) => {
      if (url === feathersoft.HOMEPAGE_URL || url === feathersoft.CAREERS_URL) {
        return homepageHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Feathersoft fails closed when the homepage handoff changes or the careers page starts exposing public jobs', async () => {
  const feathersoft = await loadFeathersoftModule()

  await assert.rejects(
    feathersoft.createFeathersoftScraper().run({
      fetchText: async (url) => {
        if (url === feathersoft.HOMEPAGE_URL) {
          return homepageHtml.replace(
            'https://www.feathersoft.com/careers/',
            'https://www.feathersoft.com/contact-us/',
          )
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Feathersoft homepage no longer matches the verified careers handoff/i,
  )

  await assert.rejects(
    feathersoft.createFeathersoftScraper().run({
      fetchText: async (url) => {
        if (url === feathersoft.HOMEPAGE_URL) return homepageHtml
        if (url === feathersoft.CAREERS_URL) return careersWithPublicJobsHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Feathersoft careers page now appears to expose public job listings/i,
  )
})
