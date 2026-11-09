import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BAMBOOHR_JOBS_URL,
  CAREER_PAGE_URL,
  createExeevoScraper,
  hasBambooHrHandoff,
  hasEmptyOpeningsSignal,
  hasOfficialCareersSignal,
} from '../../scraper/exeevo/script.js'

const careersHtml = `
  <html>
    <head>
      <title>Careers Designed to Empower | Exeevo</title>
    </head>
    <body>
      <h2 id="h-current-job-openings">Current Job Openings</h2>
      <p>Explore our wealth of <a href="${BAMBOOHR_JOBS_URL}">career opportunities</a> across a depth of disciplines.</p>
      <p>There are no roles open at this time.</p>
    </body>
  </html>
`

test('Exeevo scraper targets the official careers page and recognizes the verified empty-state signals', () => {
  assert.equal(CAREER_PAGE_URL, 'https://exeevo.com/about-us/careers/')
  assert.equal(BAMBOOHR_JOBS_URL, 'https://exeevo.bamboohr.com/jobs/')
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.equal(hasBambooHrHandoff(careersHtml), true)
  assert.equal(hasEmptyOpeningsSignal(careersHtml), true)
})

test('run returns no jobs when Exeevo exposes the verified no-open-roles public surface', async () => {
  const requestedUrls = []
  const jobs = await createExeevoScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREER_PAGE_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [CAREER_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('run fails closed when the Exeevo public careers surface changes', async () => {
  await assert.rejects(
    createExeevoScraper().run({
      fetchText: async () => '<html><title>Unexpected</title></html>',
    }),
    /verified official public surface/i,
  )

  await assert.rejects(
    createExeevoScraper().run({
      fetchText: async () => `
        <html>
          <head><title>Careers Designed to Empower | Exeevo</title></head>
          <body>
            <h2>Current Job Openings</h2>
            <a href="${BAMBOOHR_JOBS_URL}">career opportunities</a>
            <p>Open positions are now available.</p>
          </body>
        </html>
      `,
    }),
    /no-open-roles surface/i,
  )
})
