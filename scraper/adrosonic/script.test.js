import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_API_URL,
  CAREERS_PAGE_URL,
  CAREERS_PORTAL_URL,
  HOMEPAGE_URL,
  createAdrosonicScraper,
  hasOfficialHomepageSignal,
} from './script.js'

const CURRENT_HOMEPAGE_HTML = `
<!doctype html>
<html lang="en-GB">
  <head>
    <title>Home Page - Adrosonic</title>
  </head>
  <body>
    <nav>
      <a href="https://adrosonic.com/careers/">Careers</a>
    </nav>
    <main>
      <h1>Driven By Care, Defined By Innovation</h1>
      <p>From idea to outcome, we help you transform with purpose-driven digital solutions.</p>
      <p>
        ADROSONIC empowers enterprises to accelerate growth through innovation, insight and automation —
        transforming challenges into opportunities and vision into measurable, lasting impact.
      </p>
      <p>Guiding your digital transformation with people at the centre</p>
    </main>
  </body>
</html>
`

const CAREERS_PAGE_HTML = `
<!doctype html>
<html lang="en-GB">
  <head>
    <title>Careers - Adrosonic</title>
  </head>
  <body>
    <main>
      <a href="https://adrosonic.zohorecruit.in/jobs/Careers/">See Job Opening</a>
      <a href="https://adrosonic.zohorecruit.in/jobs/Careers/">Search All Openings</a>
      <p>Stay in the loop about ADROSONIC</p>
    </main>
  </body>
</html>
`

const CAREERS_PORTAL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at Careers</title>
    <meta property="og:url" content="https://adrosonic.zohorecruit.in/jobs/Careers/" />
  </head>
  <body>
    <input id="pageJson" />
    <input id="moduleMeta" />
    <input id="jobs" />
  </body>
</html>
`

const CAREERS_API_PAYLOAD = {
  code: 'success',
  data: [
    {
      Industry: 'IT Services',
      Job_Type: 'Full time',
      Job_Opening_Name: 'Risk Management & Compliance Manager',
      Posting_Title: 'Risk Management & Compliance Manager',
      Country: 'India',
      $url: 'https://adrosonic.zohorecruit.in/jobs/Careers/70502000004208083/Risk-Management-Compliance-Manager?source=CareerSite',
      id: '70502000004208083',
      City: 'Mumbai',
      Remote_Job: false,
    },
  ],
}

test('Adrosonic accepts the current verified homepage positioning and returns India jobs', async () => {
  assert.equal(hasOfficialHomepageSignal(CURRENT_HOMEPAGE_HTML), true)

  const requestedTextUrls = []
  const jobs = await createAdrosonicScraper().run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)

      if (url === HOMEPAGE_URL) return CURRENT_HOMEPAGE_HTML
      if (url === CAREERS_PAGE_URL) return CAREERS_PAGE_HTML
      if (url === CAREERS_PORTAL_URL) return CAREERS_PORTAL_HTML

      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJson: async (url) => {
      assert.equal(url, CAREERS_API_URL)
      return CAREERS_API_PAYLOAD
    },
    now: () => '2026-08-15T00:00:00.000Z',
  })

  assert.deepEqual(requestedTextUrls, [
    HOMEPAGE_URL,
    CAREERS_PAGE_URL,
    CAREERS_PORTAL_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Risk Management & Compliance Manager',
    company: 'Adrosonic',
    department: null,
    location: 'Mumbai, India',
    city: 'Mumbai',
    country: 'India',
    jobId: '70502000004208083',
    requisitionId: '70502000004208083',
    sourceUrl: 'https://adrosonic.zohorecruit.in/jobs/Careers/70502000004208083/Risk-Management-Compliance-Manager?source=CareerSite',
    applyUrl: 'https://adrosonic.zohorecruit.in/jobs/Careers/70502000004208083/Risk-Management-Compliance-Manager?source=CareerSite',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: 'On-site',
    source: 'adrosonic',
    link: 'https://adrosonic.zohorecruit.in/jobs/Careers/70502000004208083/Risk-Management-Compliance-Manager?source=CareerSite',
    scrapedAt: '2026-08-15T00:00:00.000Z',
  })
})
