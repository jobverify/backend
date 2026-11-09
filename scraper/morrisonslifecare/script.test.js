import assert from 'node:assert/strict'
import test from 'node:test'

import {
  APPLY_URL,
  CAREERS_URL,
  createMorrisonsLifecareScraper,
  extractJobCards,
  extractJobDetail,
} from './script.js'

const sampleCareersHtml = `
  <html>
    <body>
      <section>
        <span>Grow With Us: </span> Current Job Openings
        <a href="sales_and_marketing_executive" class="explore__card">
          <h4>Sales and Marketing Executive (Multi-site)</h4>
        </a>
        <a href="production_engineer" class="explore__card">
          <h4>Production Engineer (On-site, Chennai)</h4>
        </a>
      </section>
    </body>
  </html>
`

const sampleProductionEngineerHtml = `
  <html>
    <body>
      <h2 class="section__header" style="text-align: center;">Production Engineer (On-site, Chennai)</h2>
      <div class="description-container">
        <p class="job__description-text" style="color:#fff;">
          The Production Engineer will be responsible for managing and optimizing the manufacturing processes of medical devices.
        </p>
      </div>
      <h3 class="job__responsibilities-header">Key Responsibilities:</h3>
      <ul class="job__responsibilities-list">
        <li>Oversee daily production operations and ensure smooth workflows.</li>
        <li>Identify and resolve technical issues in the production line.</li>
      </ul>
      <h3 class="job__qualifications-header">Qualifications:</h3>
      <ul class="job__qualifications-list">
        <li>Bachelor's degree in Mechanical or Industrial Engineering.</li>
        <li>Experience in a manufacturing environment, preferably in medical devices.</li>
        <li>Strong problem-solving and communication skills.</li>
      </ul>
      <div class="apply-now-btn">
        <a href="/careers/morrisonsjobform" class="btn apply-now">Apply Now</a>
      </div>
    </body>
  </html>
`

const sampleSalesHtml = `
  <html>
    <body>
      <h2 class="section__header" style="text-align: center;">Sales and Marketing Executive (Multi-site)</h2>
      <div class="description-container">
        <p class="job__description-text" style="color:#fff;">
          The Sales and Marketing Executive will be responsible for driving business growth and client acquisition.
        </p>
      </div>
      <h3 class="job__responsibilities-header">Key Responsibilities:</h3>
      <ul class="job__responsibilities-list">
        <li>Identify and develop new business opportunities.</li>
      </ul>
      <h3 class="job__qualifications-header">Qualifications:</h3>
      <ul class="job__qualifications-list">
        <li>Bachelor's degree in Marketing, Business, or a related field.</li>
        <li>Proven experience in sales and marketing.</li>
      </ul>
      <div class="apply-now-btn">
        <a href="/careers/morrisonsjobform" class="btn apply-now">Apply Now</a>
      </div>
    </body>
  </html>
`

test('extractJobCards parses the live Morrisons Lifecare careers cards into first-party job listings', () => {
  assert.deepEqual(extractJobCards(sampleCareersHtml), [
    {
      title: 'Sales and Marketing Executive',
      location: 'India',
      city: null,
      country: 'India',
      sourceUrl: 'https://www.morrisonslifecare.com/careers/sales_and_marketing_executive',
      applyUrl: APPLY_URL,
      jobId: 'sales_and_marketing_executive',
      requisitionId: 'sales_and_marketing_executive',
      remoteStatus: null,
    },
    {
      title: 'Production Engineer',
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      sourceUrl: 'https://www.morrisonslifecare.com/careers/production_engineer',
      applyUrl: APPLY_URL,
      jobId: 'production_engineer',
      requisitionId: 'production_engineer',
      remoteStatus: 'On-site',
    },
  ])
})

test('extractJobDetail captures description, qualifications, and first-party apply link from a Morrisons role page', () => {
  const detail = extractJobDetail(sampleProductionEngineerHtml, {
    title: 'Production Engineer',
    location: 'Chennai, India',
    city: 'Chennai',
    country: 'India',
    sourceUrl: 'https://www.morrisonslifecare.com/careers/production_engineer',
    applyUrl: APPLY_URL,
    jobId: 'production_engineer',
    requisitionId: 'production_engineer',
    remoteStatus: 'On-site',
  })

  assert.equal(detail.title, 'Production Engineer')
  assert.equal(detail.location, 'Chennai, India')
  assert.equal(detail.city, 'Chennai')
  assert.equal(detail.applyUrl, APPLY_URL)
  assert.equal(detail.minimumQualification, "Bachelor's degree in Mechanical or Industrial Engineering.")
  assert.equal(detail.preferredQualification, 'Strong problem-solving and communication skills.')
  assert.equal(
    detail.experienceRequired,
    'Experience in a manufacturing environment, preferably in medical devices.',
  )
  assert.equal(detail.remoteStatus, 'On-site')
  assert.match(detail.jobDescription, /The Production Engineer will be responsible/i)
  assert.match(detail.jobDescription, /Key Responsibilities:/)
  assert.match(detail.jobDescription, /Qualifications:/)
})

test('run fetches the Morrisons careers index and detail pages and decorates jobs with scraper metadata', async () => {
  const requestedUrls = []
  const fetchMap = new Map([
    [CAREERS_URL, sampleCareersHtml],
    ['https://www.morrisonslifecare.com/careers/sales_and_marketing_executive', sampleSalesHtml],
    ['https://www.morrisonslifecare.com/careers/production_engineer', sampleProductionEngineerHtml],
  ])
  const scraper = createMorrisonsLifecareScraper({
    maxJobs: 2,
    now: () => '2026-07-11T03:00:00.000Z',
  })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      const html = fetchMap.get(url)
      if (!html) throw new Error(`Unexpected URL: ${url}`)
      return html
    },
  })

  assert.deepEqual(requestedUrls, [
    CAREERS_URL,
    'https://www.morrisonslifecare.com/careers/sales_and_marketing_executive',
    'https://www.morrisonslifecare.com/careers/production_engineer',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'Morrisons Lifecare Pvt. Ltd.')
  assert.equal(jobs[0].source, 'morrisonslifecare')
  assert.equal(jobs[0].link, APPLY_URL)
  assert.equal(jobs[0].scrapedAt, '2026-07-11T03:00:00.000Z')
  assert.equal(jobs[1].title, 'Production Engineer')
  assert.equal(jobs[1].city, 'Chennai')
})
