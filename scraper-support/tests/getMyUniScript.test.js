import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_INFO_URL,
  CONTACT_US_URL,
  HOMEPAGE_URL,
  createGetMyUniScraper,
  hasContactUsWorkWithUsSignal,
  hasInformationalCareersSignal,
  hasOfficialHomepageSignal,
} from '../../scraper/getmyuni/script.js'

const HOMEPAGE_HTML = `
  <html>
    <head>
      <title>GetMyUni - Explore Top Colleges, Courses, Fees and Exams</title>
    </head>
    <body>
      <h1>GetMyUni</h1>
      <nav>
        <a href="/top-colleges">Top Colleges</a>
        <a href="/top-courses">Top Courses</a>
        <a href="/exams">Entrance Exams</a>
      </nav>
    </body>
  </html>
`

const CONTACT_US_HTML = `
  <html>
    <body>
      <h1>Drop Us A Line</h1>
      <p>Counselling Related Queries</p>
      <p>Want to work with us? contact@getmyuni.com</p>
    </body>
  </html>
`

const CAREERS_INFO_HTML = `
  <html>
    <head>
      <title>Career Options in India 2023: Career Guidance, Field Wise Highest Paying Jobs &amp; Salary</title>
    </head>
    <body>
      <h1>Career Options in India</h1>
      <section>Trending Careers</section>
      <article>How to Become a Food Scientist in 6 Steps</article>
    </body>
  </html>
`

test('GetMyUni sentinel accepts the current no-public-jobs marketing surfaces from Saturday, July 25, 2026', () => {
  assert.equal(hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(hasContactUsWorkWithUsSignal(CONTACT_US_HTML), true)
  assert.equal(hasInformationalCareersSignal(CAREERS_INFO_HTML), true)
})

test('GetMyUni returns no jobs while the verified homepage, contact, and informational careers routes stay unchanged', async () => {
  const requestedUrls = []

  const jobs = await createGetMyUniScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === CONTACT_US_URL) return CONTACT_US_HTML
      if (url === CAREERS_INFO_URL) return CAREERS_INFO_HTML

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    CONTACT_US_URL,
    CAREERS_INFO_URL,
  ])
  assert.deepEqual(jobs, [])
})
