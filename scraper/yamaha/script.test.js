import assert from 'node:assert/strict'
import test from 'node:test'

import {
  APPLY_FORM_URL,
  CAREERS_URL,
  buildPageRequest,
  createYamahaScraper,
  extractJobCards,
  hasOfficialCareersSignal,
} from './script.js'

const pageOneHtml = `
  <html>
    <body>
      <nav>
        <a href="index.html">Home</a>
        <a href="about.html">About</a>
        <a href="functions.html">Functions</a>
        <a href="job-career.html">Career</a>
        <a href="contact.html">Contact</a>
      </nav>
      <section>
        <h2>Rev Your Career in YMRI</h2>
        <h1>How to Apply?</h1>
        <h3>YMRI Career Page</h3>
        <a href="job-quickapply.html">Apply Now</a>
        <div class="filter">
          <span>By Experience (in years)</span>
          <span>By Location</span>
        </div>
        <ul class="openings">
          <li>
            <a href="job-description.html?id=10015">AM - Brake Design Engineer</a>
            <p>Experience : 5-9 years | Location : Chennai Plant</p>
            <a href="job-description.html?id=10015">Apply</a>
          </li>
          <li>
            <a href="job-description.html?id=10014">AM - CV BD Design Engineer</a>
            <p>Experience : 4-8 years | Location : Chennai Plant</p>
            <a href="job-description.html?id=10014">Apply</a>
          </li>
          <li>
            <a href="job-description.html?id=10013">AM - Wheels &amp; Brake System Design</a>
            <p>Experience : 4-8 years | Location : Chennai Plant</p>
            <a href="job-description.html?id=10013">Apply</a>
          </li>
          <li>
            <a href="job-description.html?id=10012">Suspension System Design Engineer</a>
            <p>Experience : 3-6 years | Location : Chennai Plant</p>
            <a href="job-description.html?id=10012">Apply</a>
          </li>
          <li>
            <a href="job-description.html?id=10011">AGM - Product Planning</a>
            <p>Experience : 8-12 years | Location : Surajpur Plant</p>
            <a href="job-description.html?id=10011">Apply</a>
          </li>
        </ul>
      </section>
      <h5>Contact Information</h5>
    </body>
  </html>
`

const pageTwoHtml = `
  <html>
    <body>
      <section>
        <h2>Rev Your Career in YMRI</h2>
        <h3>YMRI Career Page</h3>
        <a href="job-quickapply.html">Apply Now</a>
        <div class="filter">
          <span>By Experience (in years)</span>
          <span>By Location</span>
        </div>
        <ul class="openings">
          <li>
            <a href="job-description.html?id=10006">Assistant Manager - Color &amp; Graphics</a>
            <p>Experience : 4-8 years | Location : Chennai Plant</p>
            <a href="job-description.html?id=10006">Apply</a>
          </li>
        </ul>
      </section>
      <h5>Contact Information</h5>
    </body>
  </html>
`

const zeroJobsHtml = `
  <html>
    <body>
      <h2>Rev Your Career in YMRI</h2>
      <h3>YMRI Career Page</h3>
      <a href="job-quickapply.html">Apply Now</a>
      <div>By Experience (in years)</div>
      <div>By Location</div>
      <div>No current openings</div>
    </body>
  </html>
`

test('Yamaha careers constants stay pinned to the first-party YMRI listing and apply routes', () => {
  assert.equal(CAREERS_URL, 'https://ymri.yamaha-motor-india.com/job-career.html')
  assert.equal(APPLY_FORM_URL, 'https://ymri.yamaha-motor-india.com/job-quickapply.html')
  assert.equal(hasOfficialCareersSignal(pageOneHtml), true)
  assert.equal(hasOfficialCareersSignal('<html><body>Yamaha careers archive</body></html>'), false)
  assert.deepEqual(buildPageRequest({ pageNumber: 1 }), {
    url: CAREERS_URL,
    method: 'GET',
    body: null,
  })
  assert.deepEqual(buildPageRequest({ pageNumber: 2 }), {
    url: CAREERS_URL,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Referer: CAREERS_URL,
    },
    body: 'page_number=2',
  })
})

test('extractJobCards reads Yamaha title, experience, location, and same-domain detail links', () => {
  assert.deepEqual(extractJobCards(pageTwoHtml), [
    {
      title: 'Assistant Manager - Color & Graphics',
      company: 'Yamaha Motor Research and Development India',
      department: 'Color & Graphics',
      location: 'Chennai Plant, India',
      city: 'Chennai',
      country: 'India',
      jobId: '10006',
      requisitionId: '10006',
      sourceUrl: 'https://ymri.yamaha-motor-india.com/job-description.html?id=10006',
      applyUrl: 'https://ymri.yamaha-motor-india.com/job-description.html?id=10006',
      employmentType: null,
      experienceRequired: '4-8 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
  ])
})

test('run paginates Yamaha listing pages and stops when a later page returns no jobs', async () => {
  const requested = []
  const scraper = createYamahaScraper({ maxPages: 4 })

  const jobs = await scraper.run({
    fetchPage: async (request) => {
      requested.push(request)

      if (request.method === 'GET') {
        return {
          status: 200,
          url: CAREERS_URL,
          html: pageOneHtml,
        }
      }

      if (request.body === 'page_number=2') {
        return {
          status: 200,
          url: CAREERS_URL,
          html: pageTwoHtml,
        }
      }

      if (request.body === 'page_number=3') {
        return {
          status: 200,
          url: CAREERS_URL,
          html: zeroJobsHtml,
        }
      }

      throw new Error(`Unexpected request: ${JSON.stringify(request)}`)
    },
  })

  assert.deepEqual(requested, [
    {
      url: CAREERS_URL,
      method: 'GET',
      body: null,
    },
    {
      url: CAREERS_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Referer: CAREERS_URL,
      },
      body: 'page_number=2',
    },
    {
      url: CAREERS_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Referer: CAREERS_URL,
      },
      body: 'page_number=3',
    },
  ])
  assert.equal(jobs.length, 6)
  assert.equal(jobs[0].source, 'yamaha')
  assert.equal(jobs[0].jobId, '10015')
  assert.equal(jobs[4].jobId, '10011')
  assert.equal(jobs[5].jobId, '10006')
  assert.equal(
    jobs[5].link,
    'https://ymri.yamaha-motor-india.com/job-description.html?id=10006',
  )
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
