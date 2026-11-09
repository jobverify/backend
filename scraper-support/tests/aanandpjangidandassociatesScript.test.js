import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  createAanandPJangidAndAssociatesScraper,
  extractSearchResults,
  hasOfficialCareersSurface,
} from '../../scraper/aanandpjangidandassociates/script.js'

const careersHtml = `
  <html>
    <head><title>AJA - Careers</title></head>
    <body>
      <section class="career-hero">
        <h1>Join Our Team</h1>
        <p>We are looking for passionate innovators to help us build the future of data analytics and business resilience.</p>
        <a href="#open-positions">View Open Positions</a>
      </section>
      <section class="open-positions-section" id="open-positions">
        <h2>Current Openings</h2>
        <div class="job-card">
          <div class="job-card-header"><h3>Data Analytics Consultant</h3></div>
          <div class="job-card-body"><p></p></div>
          <div class="job-card-footer">
            <a href="#" class="apply-btn" data-job-title="Data Analytics Consultant">Apply Now</a>
          </div>
        </div>
        <div class="job-card">
          <div class="job-card-header"><h3>Cyber Security Analyst</h3></div>
          <div class="job-card-body"><p></p></div>
          <div class="job-card-footer">
            <a href="#" class="apply-btn" data-job-title="Cyber Security Analyst">Apply Now</a>
          </div>
        </div>
        <div class="job-card">
          <div class="job-card-header"><h3>Forensic Audit Manager</h3></div>
          <div class="job-card-body"><p></p></div>
          <div class="job-card-footer">
            <a href="#" class="apply-btn" data-job-title="Forensic Audit Manager">Apply Now</a>
          </div>
        </div>
      </section>
      <footer>
        <div id="bangalore">Bangalore-560064</div>
        <div id="thiruvananthapuram">Thiruvananthapuram-695035</div>
      </footer>
    </body>
  </html>
`

test('AJA scraper targets the homepage-linked official careers page and recognizes its openings surface', () => {
  assert.equal(CAREER_PAGE_URL, 'https://www.ajafirm.com/career.html')
  assert.equal(hasOfficialCareersSurface(careersHtml), true)
})

test('extractSearchResults parses AJA current opening cards from the public careers page', () => {
  assert.deepEqual(
    extractSearchResults(careersHtml).map((job) => ({
      title: job.title,
      jobId: job.jobId,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      country: job.country,
    })),
    [
      {
        title: 'Data Analytics Consultant',
        jobId: 'data-analytics-consultant',
        sourceUrl: 'https://www.ajafirm.com/career.html#open-positions',
        applyUrl: 'https://www.ajafirm.com/career.html#open-positions',
        country: 'India',
      },
      {
        title: 'Cyber Security Analyst',
        jobId: 'cyber-security-analyst',
        sourceUrl: 'https://www.ajafirm.com/career.html#open-positions',
        applyUrl: 'https://www.ajafirm.com/career.html#open-positions',
        country: 'India',
      },
      {
        title: 'Forensic Audit Manager',
        jobId: 'forensic-audit-manager',
        sourceUrl: 'https://www.ajafirm.com/career.html#open-positions',
        applyUrl: 'https://www.ajafirm.com/career.html#open-positions',
        country: 'India',
      },
    ],
  )
})

test('run returns current AJA opening cards with scraper metadata', async () => {
  const requestedUrls = []
  const jobs = await createAanandPJangidAndAssociatesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, [CAREER_PAGE_URL])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'aanandpjangidandassociates')
  assert.equal(jobs[0].company, 'Aanand P Jangid and Associates LLP')
  assert.equal(jobs[0].title, 'Data Analytics Consultant')
  assert.equal(jobs[0].link, 'https://www.ajafirm.com/career.html#open-positions')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('run fails closed when the AJA official careers surface changes', async () => {
  await assert.rejects(
    createAanandPJangidAndAssociatesScraper().run({
      fetchText: async () => '<html><body><h1>Open Positions</h1></body></html>',
    }),
    /verified public openings surface/i,
  )
})
