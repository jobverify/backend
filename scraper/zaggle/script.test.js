import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../../scraper-support/providers/index.js'
import {
  extractJobs,
  hasOfficialCareersSignal,
  run,
} from './script.js'

const careersHtml = `
  <html>
    <head><title>Careers | Zaggle</title></head>
    <body>
      <h1>Be Part Of Zaggle's Journey</h1>
      <h2>Why Work at Zaggle?</h2>
      <h2>Zaggle Open Roles</h2>
      <section class="job-card">
        <h3>Implementation</h3>
        <h4>Implementation Project Manager</h4>
        <p>5-7 yrs exp Hyderabad Fulltime</p>
        <div>Job Description</div>
        <a href="https://www.linkedin.com/jobs/view/123">Apply Now</a>
      </section>
    </body>
  </html>
`

test('Zaggle is matched by the exact company name in the coverage catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nZaggle\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.matched[0].source, 'zaggle')
})

test('extractJobs normalizes a first-party India role and its application URL', () => {
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(extractJobs(careersHtml), [{
    title: 'Implementation Project Manager',
    company: 'Zaggle',
    location: 'Hyderabad',
    city: 'Hyderabad',
    country: 'India',
    link: 'https://www.linkedin.com/jobs/view/123',
    applyUrl: 'https://www.linkedin.com/jobs/view/123',
    sourceUrl: 'https://www.zaggle.in/careers',
  }])
})

test('run fails closed when the trusted Zaggle careers signature is missing', async () => {
  await assert.rejects(
    () => run({ fetchPage: async () => ({ status: 200, html: '<html><body>Not Zaggle</body></html>' }) }),
    /verified official careers page no longer matches/,
  )
})
