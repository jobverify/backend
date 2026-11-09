import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  SOURCE,
  extractJobCards,
  hasOfficialCareersSignal,
  run,
} from './script.js'

const careersHtml = `
  <html>
    <head><title>Vrinsoft Careers | Jobs in AI, Web &amp; Software Development</title></head>
    <body>
      <h1>Come Build Your Career at Vrinsoft</h1>
      <div id="accordionCareerHiring">
        <div class="accordion-item accordion-item-career">
          <div class="accordion-header" id="career-hiring-heading1">
            <div class="accordion-header-left">
              <p class="heading-four blue-text">BDE</p>
              <div class="career-hiring-details">1 - 4 years Ahmedabad</div>
            </div>
            <div class="accordion-header-right">
              <a href="javascript:void(0)" class="square-blue-btn apply-btn" data-id="277">Apply Now</a>
            </div>
          </div>
          <div class="career-hiring-hr"><p>Apply Now On <a href="mailto:hr@vrinsofts.com">hr@vrinsofts.com</a></p></div>
        </div>
        <div class="accordion-item accordion-item-career">
          <div class="accordion-header" id="career-hiring-heading2">
            <div class="accordion-header-left">
              <p class="heading-four blue-text">Content Writer</p>
              <div class="career-hiring-details">2 - 3 years Ahmedabad</div>
            </div>
            <div class="accordion-header-right">
              <a href="javascript:void(0)" class="square-blue-btn apply-btn" data-id="266">Apply Now</a>
            </div>
          </div>
          <div class="career-hiring-hr"><p>Apply Now On <a href="mailto:hr@vrinsofts.com">hr@vrinsofts.com</a></p></div>
        </div>
      </div>
    </body>
  </html>
`

test('Vrinsoft recognizes the live accordion-based careers surface and extracts stable role anchors', () => {
  assert.equal(SOURCE, 'vrinsofttechnology')
  assert.equal(COMPANY, 'Vrinsoft Technology')
  assert.equal(CAREERS_URL, 'https://www.vrinsofts.com/career.html')
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(extractJobCards(careersHtml), [
    {
      title: 'BDE',
      location: 'Ahmedabad, India',
      city: 'Ahmedabad',
      sourceUrl: 'https://www.vrinsofts.com/career.html#career-hiring-heading1',
      applyUrl: 'https://www.vrinsofts.com/career.html#career-hiring-heading1',
      jobId: '277',
      requisitionId: '277',
      experienceRequired: '1 - 4 years',
    },
    {
      title: 'Content Writer',
      location: 'Ahmedabad, India',
      city: 'Ahmedabad',
      sourceUrl: 'https://www.vrinsofts.com/career.html#career-hiring-heading2',
      applyUrl: 'https://www.vrinsofts.com/career.html#career-hiring-heading2',
      jobId: '266',
      requisitionId: '266',
      experienceRequired: '2 - 3 years',
    },
  ])
})

test('Vrinsoft runner decorates accordion openings with shared scraper fields', async () => {
  const jobs = await run({
    fetchText: async () => careersHtml,
    now: () => '2026-08-06T00:00:00.000Z',
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, COMPANY)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].source, SOURCE)
  assert.equal(jobs[0].link, 'https://www.vrinsofts.com/career.html#career-hiring-heading1')
  assert.equal(jobs[0].scrapedAt, '2026-08-06T00:00:00.000Z')
})
