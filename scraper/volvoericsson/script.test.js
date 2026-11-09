import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  COMPANY,
  ERICSSON_CAREERS_URL,
  OFFICIAL_CAREER_URLS,
  SOURCE,
  VOLVO_CAREERS_URL,
  VOLVO_JOBS_URL,
  createVolvoEricssonScraper,
  extractVolvoJobsUrl,
  getRunnerMetadata,
  hasDistinctOfficialCareerSurfaces,
  hasEricssonCareersSignal,
  hasVolvoCareersSignal,
} from './script.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const readFixture = (name) => readFileSync(path.join(currentDir, 'fixtures', name), 'utf8')

const volvoCareersHtml = readFixture('volvo-careers.html')
const ericssonCareersHtml = readFixture('ericsson-careers.html')

test('pins the Volvo-Ericsson sentinel to the verified official Volvo and Ericsson careers surfaces', () => {
  assert.equal(SOURCE, 'volvoericsson')
  assert.equal(COMPANY, 'Volvo-Ericsson')
  assert.equal(VOLVO_CAREERS_URL, 'https://www.volvogroup.com/en/careers.html')
  assert.equal(VOLVO_JOBS_URL, 'https://jobs.volvogroup.com/')
  assert.equal(ERICSSON_CAREERS_URL, 'https://jobs.ericsson.com/careers')
  assert.deepEqual(OFFICIAL_CAREER_URLS, [
    VOLVO_CAREERS_URL,
    ERICSSON_CAREERS_URL,
  ])
  assert.equal(hasVolvoCareersSignal(volvoCareersHtml), true)
  assert.equal(extractVolvoJobsUrl(volvoCareersHtml), VOLVO_JOBS_URL)
  assert.equal(hasEricssonCareersSignal(ericssonCareersHtml), true)
  assert.equal(
    hasDistinctOfficialCareerSurfaces({
      volvoCareersHtml,
      ericssonCareersHtml,
    }),
    true,
  )
})

test('returns no jobs when Volvo-Ericsson only resolves to separate official Volvo and Ericsson career sites', async () => {
  const requestedUrls = []
  const jobs = await createVolvoEricssonScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === VOLVO_CAREERS_URL) return volvoCareersHtml
      if (url === ERICSSON_CAREERS_URL) return ericssonCareersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, OFFICIAL_CAREER_URLS)
  assert.deepEqual(jobs, [])
})

test('returns runner metadata for later registry integration without claiming a standalone jobs surface', () => {
  assert.deepEqual(getRunnerMetadata(), {
    name: SOURCE,
    dryRunFile: 'jobs.json',
    provider: {
      source: SOURCE,
      companyName: COMPANY,
      companyCareerPage: VOLVO_CAREERS_URL,
      alternateCareerPages: [ERICSSON_CAREERS_URL],
      adapter: 'script',
      atsPlatform: 'official-company-sites-no-standalone-volvo-ericsson-surface',
      countryFilter: 'India',
    },
  })
})

test('fails closed when either verified official careers surface changes or no longer stays distinct', async () => {
  await assert.rejects(
    createVolvoEricssonScraper().run({
      fetchText: async (url) => {
        if (url === VOLVO_CAREERS_URL) return '<html><body>unexpected</body></html>'
        if (url === ERICSSON_CAREERS_URL) return ericssonCareersHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified Volvo Group careers surface/i,
  )

  await assert.rejects(
    createVolvoEricssonScraper().run({
      fetchText: async (url) => {
        if (url === VOLVO_CAREERS_URL) return volvoCareersHtml
        if (url === ERICSSON_CAREERS_URL) return '<html><body>unexpected</body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified Ericsson careers surface/i,
  )

  await assert.rejects(
    createVolvoEricssonScraper().run({
      fetchText: async (url) => {
        if (url === VOLVO_CAREERS_URL) {
          return volvoCareersHtml.replace(
            '</main>',
            '<p>Careers at Ericsson</p></main>',
          )
        }

        if (url === ERICSSON_CAREERS_URL) return ericssonCareersHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /no longer matches the verified distinct-company sentinel/i,
  )
})
