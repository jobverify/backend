import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_PAGE_URL,
  createCynlrScraper,
  extractCynlrJobs,
} from './script.js'

const rolePageHtml = `
  <main>
    <section>
      <h2>Categories</h2>
      <h3>Software Development</h3>
      <button type="button">Software Engineering Roles</button>
      <button type="button">Apply</button>
    </section>
    <section>
      <div>India Address</div>
      <h1>Warp Building, SJR I Park, Rd Number 9, EPIP Zone, Whitefield, Bengaluru, Karnataka - 560066</h1>
      <div>Contact talent@cynlr.com</div>
    </section>
  </main>
`

test('extractCynlrJobs maps the visible India software engineering role from the official careers page', () => {
  assert.deepEqual(extractCynlrJobs(rolePageHtml), [{
    title: 'Software Engineering Roles',
    company: 'CynLr',
    department: 'Software Development',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'cynlr-software-engineering-roles',
    requisitionId: 'software-engineering-roles',
    sourceUrl: CAREERS_PAGE_URL,
    applyUrl: CAREERS_PAGE_URL,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Apply via the official CynLr careers page or by contacting talent@cynlr.com.',
  }])
})

test('run fetches the official CynLr careers page and decorates extracted jobs', async () => {
  const scraper = createCynlrScraper({
    fetchText: async (url) => {
      assert.equal(url, CAREERS_PAGE_URL)
      return rolePageHtml
    },
  })

  const jobs = await scraper.run()

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'cynlr')
  assert.equal(jobs[0].link, CAREERS_PAGE_URL)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
