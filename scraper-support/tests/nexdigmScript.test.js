import assert from 'node:assert/strict'
import test from 'node:test'

const loadNexdigmModule = async () => {
  try {
    return await import('../../scraper/nexdigm/script.js')
  } catch {
    assert.fail('Expected Nexdigm scraper module at ../../scraper/nexdigm/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Nexdigm | Explore Career Opportunities</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <h2>Job Search</h2>
      <p>Current Opportunities</p>
      <p>Join a team that allows you to grow and gives you the freedom to make creative decisions</p>
      <a href="https://www.nexdigm.com/careers/current-openings/">View All</a>
      <a href="https://www.nexdigm.com/careers/current-openings/">Current Openings</a>
    </main>
  </body>
</html>
`

const currentOpeningsShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Opportunities | Job Openings | Nexdigm</title>
  </head>
  <body>
    <div class="inside-content">
      <h1 class="main-hd" style="display:none;">Current Openings</h1>
      <form id="my_form">
        <div class="join-formarea">
          <div class="result-container-top2 result-row">
            <div class="form-control2 search-left">
              <div class="input-area">
                <input type="text" placeholder="Search by Position Name, Location Name etc" id="ser" name="ser">
              </div>
              <div class="input-area2">
                <input type="hidden" id="arr" name="arr" value="error code: 502 ">
              </div>
              <div class="input-area3">
                <input class="btn" id="submitbutton" type="submit" value="Search">
              </div>
            </div>
          </div>
        </div>
      </form>
      <div class="result-container" id="load_data"></div>
      <a href="#" id="loadmore">Load More</a>
    </div>
    <script>
      jQuery.ajax({ url : "https://www.nexdigm.com/joblist.php" });
    </script>
  </body>
</html>
`

const currentOpeningsWithCardsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Opportunities | Job Openings | Nexdigm</title>
  </head>
  <body>
    <div class="inside-content">
      <h1 class="main-hd" style="display:none;">Current Openings</h1>
      <form id="my_form">
        <div class="join-formarea">
          <div class="result-container-top2 result-row">
            <div class="form-control2 search-left">
              <div class="input-area">
                <input type="text" placeholder="Search by Position Name, Location Name etc" id="ser" name="ser">
              </div>
              <div class="input-area2">
                <input type="hidden" id="arr" name="arr" value="error code: 502 ">
              </div>
            </div>
          </div>
        </div>
      </form>
      <div class="result-container" id="load_data">
        <div class="result-inside careerdata">
          <div class="result-heading result-heading3"><a href="https://www.nexdigm.com/career-details?id=a69c23b6d80360">Consultant - Bengaluru - Indirect Tax</a></div>
          <p><span><b>Office Location : </b></span>Bengaluru, Karnataka, India<br/></p>
          <p><span><b>Department : </b></span>Indirect Tax</p>
          <p><span><b>Location City</b></span><span>Bengaluru</span></p>
          <p><span><b>Employee Type</b></span><span>Full-time</span></p>
          <p><span><b>Posted</b></span><span>August 4, 2026</span></p>
          <button onclick="apply('https://nexdigm.darwinbox.in/ms/candidate/careers/job?job_id=abc123');">Apply</button>
        </div>
      </div>
      <a href="#" id="loadmore">Load More</a>
    </div>
    <script>
      jQuery.ajax({ url : "https://www.nexdigm.com/joblist.php" });
    </script>
  </body>
</html>
`

const detailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <div class="result-left">Experience</div>
    <div class="result-right">5-7 years</div>
    <div class="job-title">Job Description</div>
    <div>Support indirect tax delivery for enterprise clients.</div>
    <input value="Apply">
    <button onclick="apply('https://nexdigm.darwinbox.in/ms/candidate/careers/job?job_id=abc123');">Apply</button>
  </body>
</html>
`

test('Nexdigm helpers stay pinned to the verified August 4, 2026 careers shell and current openings parser contract', async () => {
  const nexdigm = await loadNexdigmModule()

  assert.equal(nexdigm.SOURCE, 'nexdigm')
  assert.equal(nexdigm.COMPANY, 'Nexdigm')
  assert.equal(nexdigm.VERIFIED_ON, '2026-08-04')
  assert.equal(nexdigm.HOMEPAGE_URL, 'https://www.nexdigm.com/')
  assert.equal(nexdigm.CAREERS_URL, 'https://www.nexdigm.com/careers/')
  assert.equal(
    nexdigm.CURRENT_OPENINGS_URL,
    'https://www.nexdigm.com/careers/current-openings/',
  )
  assert.equal(nexdigm.CURRENT_OPENINGS_DATA_URL, 'https://www.nexdigm.com/joblist.php')
  assert.equal(nexdigm.CURRENT_OPENINGS_UPSTREAM_ERROR, 'error code: 502')
  assert.equal(nexdigm.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    nexdigm.extractCurrentOpeningsUrl(careersHtml),
    'https://www.nexdigm.com/careers/current-openings/',
  )
  assert.equal(nexdigm.hasVerifiedCurrentOpeningsShell(currentOpeningsShellHtml), true)
  assert.equal(
    nexdigm.extractCurrentOpeningsErrorValue(currentOpeningsShellHtml),
    'error code: 502',
  )
  assert.equal(
    nexdigm.hasVerifiedUpstreamErrorCurrentOpeningsState(currentOpeningsShellHtml),
    true,
  )
})

test('extractInlineJobs and enrichInlineJobFromDetail keep visible current-opening cards and Darwinbox apply handoffs', async () => {
  const nexdigm = await loadNexdigmModule()
  const [job] = nexdigm.extractInlineJobs(currentOpeningsWithCardsHtml, {
    scrapedAt: '2026-08-04T12:30:00.000Z',
  })

  assert.deepEqual(job, {
    title: 'Consultant - Bengaluru - Indirect Tax',
    company: 'Nexdigm',
    department: 'Indirect Tax',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    state: null,
    country: 'India',
    jobId: 'a69c23b6d80360',
    requisitionId: 'a69c23b6d80360',
    sourceUrl: 'https://www.nexdigm.com/career-details?id=a69c23b6d80360',
    applyUrl: 'https://nexdigm.darwinbox.in/ms/candidate/careers/job?job_id=abc123',
    link: 'https://nexdigm.darwinbox.in/ms/candidate/careers/job?job_id=abc123',
    source: 'nexdigm',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Office Location: Bengaluru, Karnataka, India\nDepartment: Indirect Tax\nPosted: August 4, 2026',
    scrapedAt: '2026-08-04T12:30:00.000Z',
  })

  assert.deepEqual(nexdigm.enrichInlineJobFromDetail(job, detailHtml), {
    ...job,
    applyUrl: 'https://nexdigm.darwinbox.in/ms/candidate/careers/job?job_id=abc123',
    link: 'https://nexdigm.darwinbox.in/ms/candidate/careers/job?job_id=abc123',
    experienceRequired: '5-7 years',
    jobDescription: 'Support indirect tax delivery for enterprise clients.',
    publicExperienceChecked: true,
  })
})

test('run validates the verified Nexdigm careers shell and returns no jobs while the reviewed upstream-error openings state persists', async () => {
  const nexdigm = await loadNexdigmModule()
  const requestedUrls = []

  const jobs = await nexdigm.createNexdigmScraper({
    now: () => '2026-08-04T12:30:00.000Z',
  }).run({
    fetchHtml: async (url) => {
      requestedUrls.push(url)

      if (url === nexdigm.CAREERS_URL) return careersHtml
      if (url === nexdigm.CURRENT_OPENINGS_URL) return currentOpeningsShellHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.nexdigm.com/careers/',
    'https://www.nexdigm.com/careers/current-openings/',
  ])
  assert.deepEqual(jobs, [])
})

test('run fails closed when the verified Nexdigm careers shell or reviewed upstream-error openings state drifts materially', async () => {
  const nexdigm = await loadNexdigmModule()

  await assert.rejects(
    nexdigm.createNexdigmScraper().run({
      fetchHtml: async (url) => {
        if (url === nexdigm.CAREERS_URL) {
          return '<html><body><h1>Careers</h1><a href="/apply">Apply</a></body></html>'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified careers page no longer matches/i,
  )

  await assert.rejects(
    nexdigm.createNexdigmScraper().run({
      fetchHtml: async (url) => {
        if (url === nexdigm.CAREERS_URL) return careersHtml
        if (url === nexdigm.CURRENT_OPENINGS_URL) {
          return currentOpeningsShellHtml.replace('error code: 502', 'Nexdigm Private Limited')
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /reviewed upstream-error empty state/i,
  )
})
