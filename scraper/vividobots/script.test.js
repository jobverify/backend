import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import {
  AROOPA_FORM_ID,
  CAREERS_URL,
  COMPANY,
  HOMEPAGE_URL,
  JOB_APPLICATION_URL,
  SOURCE,
  createVividobotsScraper,
  extractRegisterUrl,
  hasOfficialCareersSignal,
  hasOfficialHomepageSignal,
  hasOfficialJobApplicationSignal,
  pageExposesPublicJobListings,
} from './script.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const readFixture = (name) => readFileSync(path.join(currentDir, 'fixtures', name), 'utf8')

const homepageHtml = readFixture('homepage.html')
const careersHtml = readFixture('careers.html')
const jobApplicationHtml = readFixture('job-application.html')

test('pins the Vividobots sentinel to the verified official first-party surfaces', () => {
  assert.equal(SOURCE, 'vividobots')
  assert.equal(COMPANY, 'Vividobots')
  assert.equal(HOMEPAGE_URL, 'https://www.vividobots.com/')
  assert.equal(CAREERS_URL, 'https://www.vividobots.com/careers')
  assert.equal(JOB_APPLICATION_URL, 'https://www.vividobots.com/job-application')
  assert.equal(AROOPA_FORM_ID, '690c91a7a673722dcf6999cc')

  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.equal(extractRegisterUrl(careersHtml), JOB_APPLICATION_URL)
  assert.equal(hasOfficialJobApplicationSignal(jobApplicationHtml), true)
  assert.equal(pageExposesPublicJobListings(careersHtml), false)
  assert.equal(pageExposesPublicJobListings(jobApplicationHtml), false)
})

test('returns no jobs while Vividobots only exposes the verified candidate-portal flow', async () => {
  const requestedUrls = []

  const jobs = await createVividobotsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === CAREERS_URL) return careersHtml
      if (url === JOB_APPLICATION_URL) return jobApplicationHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CAREERS_URL, JOB_APPLICATION_URL])
  assert.deepEqual(jobs, [])
})

test('returns discovery-only evidence when the Vividobots homepage blocks public access with HTTP 403', async () => {
  const forbiddenError = Object.assign(
    new Error(`HTTP 403 for ${HOMEPAGE_URL}`),
    { status: 403 },
  )

  const jobs = await createVividobotsScraper({
    now: () => '2026-09-14T00:00:00.000Z',
  }).run({
    fetchText: async () => { throw forbiddenError },
  })

  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'discovery-only')
  assert.equal(evidence?.surface, HOMEPAGE_URL)
  assert.equal(evidence?.listingComplete, false)
})

test('fails closed when the verified first-party pages drift or public listings appear', async () => {
  await assert.rejects(
    createVividobotsScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return '<html><body>unexpected</body></html>'
        if (url === CAREERS_URL) return careersHtml
        if (url === JOB_APPLICATION_URL) return jobApplicationHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage no longer matches/i,
  )

  await assert.rejects(
    createVividobotsScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageHtml
        if (url === CAREERS_URL) {
          return careersHtml.replace(JOB_APPLICATION_URL, 'https://www.vividobots.com/contact-us')
        }

        if (url === JOB_APPLICATION_URL) return jobApplicationHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /candidate-portal sentinel/i,
  )

  await assert.rejects(
    createVividobotsScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageHtml
        if (url === CAREERS_URL) return careersHtml
        if (url === JOB_APPLICATION_URL) {
          return `${jobApplicationHtml}<section><h2>Open positions</h2><a href="https://boards.greenhouse.io/vividobots/jobs/123">Apply now</a></section>`
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /appears to expose public job listings/i,
  )
})
