import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  CURRENT_OPENINGS_URL,
  SOURCE,
  createNexdigmScraper,
  enrichInlineJobFromDetail,
  extractCurrentOpeningsUrl,
  extractInlineJobs,
  hasOfficialCareersSignal,
  hasVerifiedCurrentOpeningsShell,
} from './script.js'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Nexdigm | Explore Career Opportunities</title>
  </head>
  <body>
    <main>
      <h1>Job Search</h1>
      <h2>Current Opportunities</h2>
      <a href="https://www.nexdigm.com/careers/current-openings/">View All</a>
    </main>
  </body>
</html>
`

const CURRENT_OPENINGS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Opportunities | Job Openings | Nexdigm</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <form id="my_form">
      <input type="text" placeholder="Search by Position Name, Location Name etc" />
      <input id="arr" name="arr" value='[{"job_id":"a686ccaa1929c0"}]' />
      <div id="load_data">
        <div class="result-inside careerdata">
          <div class="result-col">
            <div class="result-heading result-heading3 dgdfg">
              <a href="https://www.nexdigm.com/career-details?id=a686ccaa1929c0">Sr. Manager - Indirect Taxation</a>
            </div>
            <div class="result-col2">
              <div class="result-heading2"><span><b>Location City</b></span> <span>Mumbai</span></div>
              <div class="result-heading2"><span><b>Employee Type</b></span> <span>Permanent</span></div>
              <div class="result-heading2"><span><b>Posted</b></span> <span>1 year(s) ago</span></div>
            </div>
            <div class="result-content">
              <p><span><b>Office Location : </b></span>Lower Parel , Mumbai, Maharashtra, India ,<br/></p>
              <p><span><b>Department : </b></span>Indirect Tax</p>
              <input class="btn" type="button" value="Apply" onclick="apply('https://gene.darwinbox.in/ms/candidate/careers/a686ccaa1929c0?apply=1');">
            </div>
          </div>
        </div>
      </div>
      <button id="loadmore" type="button">Load more</button>
      <script>const endpoint = "https://www.nexdigm.com/joblist.php"</script>
    </form>
  </body>
</html>
`

const EMPTY_STATE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Opportunities | Job Openings | Nexdigm</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <form id="my_form">
      <input type="text" placeholder="Search by Position Name, Location Name etc" />
      <input id="arr" name="arr" value="error code: 502" />
      <div id="load_data"></div>
      <button id="loadmore" type="button">Load more</button>
      <script>const endpoint = "https://www.nexdigm.com/joblist.php"</script>
    </form>
  </body>
</html>
`

const CAREER_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Details - Nexdigm</title>
  </head>
  <body>
    <div class="join-container">
      <div class="main-hd result-heading"><a href="#">Sr. Manager - Indirect Taxation</a></div>
      <div class="result-container">
        <div class="result-container-top2 result-container-top3">
          <div class="result-detailarea">
            <div class="detail-col border-left">
              <div class="result-left">Location City</div>
              <div class="result-right">Mumbai</div>
            </div>
            <div class="detail-col border-left">
              <div class="result-left">Department</div>
              <div class="result-right">Indirect Tax</div>
            </div>
            <div class="detail-col">
              <div class="result-left">Experience</div>
              <div class="result-right">8 - 10 Years</div>
            </div>
          </div>
          <div class="result-inside result-inside2">
            <div class="result-col">
              <div class="result-detailarea2">
                <div class="result-inside2">
                  <div class="job-title">Employee Type</div>
                  Permanent
                </div>
                <div class="result-inside2">
                  <div class="job-title">Job Description</div>
                  <p>Lead indirect tax advisory and compliance delivery for strategic clients.</p>
                </div>
              </div>
            </div>
          </div>
          <input class="btn" type="button" value="Apply" onclick="apply('https://gene.darwinbox.in/ms/candidate/careers/a686ccaa1929c0?apply=1');">
        </div>
      </div>
    </div>
  </body>
</html>
`

test('Nexdigm recognizes the official careers handoff and verified current-openings shell', () => {
  assert.equal(hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(extractCurrentOpeningsUrl(CAREERS_HTML), CURRENT_OPENINGS_URL)
  assert.equal(hasVerifiedCurrentOpeningsShell(CURRENT_OPENINGS_HTML), true)
})

test('Nexdigm extracts public inline job cards from the current-openings shell', () => {
  const jobs = extractInlineJobs(CURRENT_OPENINGS_HTML, {
    scrapedAt: '2026-08-04T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'Sr. Manager - Indirect Taxation',
      company: COMPANY,
      department: 'Indirect Tax',
      location: 'Lower Parel, Mumbai, Maharashtra, India',
      city: 'Mumbai',
      state: null,
      country: 'India',
      jobId: 'a686ccaa1929c0',
      requisitionId: 'a686ccaa1929c0',
      sourceUrl: 'https://www.nexdigm.com/career-details?id=a686ccaa1929c0',
      applyUrl: 'https://gene.darwinbox.in/ms/candidate/careers/a686ccaa1929c0?apply=1',
      link: 'https://gene.darwinbox.in/ms/candidate/careers/a686ccaa1929c0?apply=1',
      source: SOURCE,
      employmentType: 'Permanent',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Office Location: Lower Parel, Mumbai, Maharashtra, India\nDepartment: Indirect Tax\nPosted: 1 year(s) ago',
      scrapedAt: '2026-08-04T00:00:00.000Z',
    },
  ])
})

test('Nexdigm enriches inline jobs from the public career-details page', () => {
  const [listingJob] = extractInlineJobs(CURRENT_OPENINGS_HTML, {
    scrapedAt: '2026-08-04T00:00:00.000Z',
  })

  const job = enrichInlineJobFromDetail(listingJob, CAREER_DETAIL_HTML)

  assert.equal(job.experienceRequired, '8 - 10 Years')
  assert.equal(job.jobDescription, 'Lead indirect tax advisory and compliance delivery for strategic clients.')
  assert.equal(job.publicExperienceChecked, true)
  assert.equal(job.applyUrl, 'https://gene.darwinbox.in/ms/candidate/careers/a686ccaa1929c0?apply=1')
})

test('Nexdigm preserves the reviewed upstream-error empty fallback when no public cards are present', async () => {
  const scraper = createNexdigmScraper({
    now: () => '2026-08-04T00:00:00.000Z',
  })

  const jobs = await scraper.run({
    fetchHtml: async (url) => {
      if (url === CAREERS_URL) return CAREERS_HTML
      if (url === CURRENT_OPENINGS_URL) return EMPTY_STATE_HTML
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Nexdigm run() enriches public cards from career-details pages before returning jobs', async () => {
  const scraper = createNexdigmScraper({
    now: () => '2026-08-04T00:00:00.000Z',
  })

  const jobs = await scraper.run({
    fetchHtml: async (url) => {
      if (url === CAREERS_URL) return CAREERS_HTML
      if (url === CURRENT_OPENINGS_URL) return CURRENT_OPENINGS_HTML
      if (url === 'https://www.nexdigm.com/career-details?id=a686ccaa1929c0') return CAREER_DETAIL_HTML
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].experienceRequired, '8 - 10 Years')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[0].jobDescription, 'Lead indirect tax advisory and compliance delivery for strategic clients.')
})
