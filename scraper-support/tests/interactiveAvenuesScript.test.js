import assert from 'node:assert/strict'
import test from 'node:test'

const careersLandingHtml = `
<!doctype html>
<html lang="en">
  <body>
    <section>
      <h1>Careers at IA</h1>
      <p>We are hiring!</p>
      <div class="cta">
        <a
          href="https://careers.ipgmediabrands.com/postings/?gh_search=&amp;department=Interactive+Avenues+-+India&amp;interest=&amp;location=India#ghjobs"
          target="_blank"
        >
          <span>Open positions</span>
        </a>
      </div>
    </section>
  </body>
</html>
`

const jobsHubHtml = `
<!doctype html>
<html lang="en">
  <body>
    <section class="section-id" id="gh_jobs"></section>
    <div class="cta-group">
      <a class="call-to-action" href="http://careers.ipgmediabrands.com/posting-workday/" target="_self">US | Canada | UK</a>
      <a class="call-to-action" href="https://careers.ipgmediabrands.com/posting-greenhouse/" target="_self">All other Locations</a>
    </div>
    <h2>Your Future Starts Here: Lead the New Era of Media and Marketing with us</h2>
  </body>
</html>
`

const jobsPageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <div id="ghjobs">
      <div class="gh-filter">
        <form class="greenhouse-office_filter-2 greenhouse-office_filter">
          <select name="department">
            <option value="Interactive Avenues - India" selected>Interactive Avenues - India</option>
          </select>
          <select name="location">
            <option value="India" selected>India (All)</option>
            <option value="Bangalore">Bangalore</option>
          </select>
        </form>
      </div>
      <div class="gh-job-table">
        <div class="display-desktop gh-job-row gh-job-header">
          <div class="display-desktop gh-job-title">Position</div>
          <div class="display-desktop gh-job-type">Agency</div>
          <div class="display-desktop gh-job-location">Location</div>
          <div class="display-desktop gh-job-apply"></div>
        </div>
        <div class="gh-job-row">
          <div class="gh-job-title"><span class="display-mobile">Positions: </span>Media: Associate Vice President/Vice President</div>
          <div class="gh-job-type"><span class="display-mobile">Agency: </span>Interactive Avenues - India</div>
          <div class="gh-job-location"><span class="display-mobile">Location: </span>India</div>
          <div class="gh-job-apply">
            <a
              class="applyNowButton gh-btn"
              href="/posting-greenhouse/?gh_search&#038;department=Interactive+Avenues+-+India&#038;interest&#038;location=India&#038;job_id=5105985007"
            >
              Apply Now
            </a>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
`

const firstDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <section class="gh-single-job">
      <h1>Media: Associate Vice President/Vice President</h1>
      <div class="gh-job-details">
        <div class="display_department"><span class="location_label">Location: </span>Bangalore, Bangalore, India</div>
      <div class="display_department"><span class="department_label">Agency: </span>Interactive Avenues - India</div>
      <div class="display_department"><span class="department_label">Ref#: </span>26720</div>
      <div class="display_department"><span class="department_label">Type of Contract: </span>Regular</div>
      </div>
      <button class="applyNowButton gh-btn gh-btn-small">Apply Now</button>
      <div class="job-content">
        <p><strong>Position Summary</strong></p>
        <p>Lead strategic media planning for major client accounts across digital channels.</p>
        <p><strong>What You Can Expect From Interactive Avenues</strong></p>
        <p>Work with a high-growth team that values insightful, daring and results-focused thinking.</p>
      </div>
      <div class="gh-job-apply-section"><div id="grnhse_app"></div></div>
    </section>
    <script src="https://boards.greenhouse.io/embed/job_board/js?for=mediabrands"></script>
    <script>
      Grnhse.Iframe.load('5105985007');
    </script>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/interactiveavenues/script.js')
  } catch {
    assert.fail('Expected Interactive Avenues scraper module at ../../scraper/interactiveavenues/script.js')
  }
}

test('Interactive Avenues pins the verified first-party landing and filtered jobs URLs', async () => {
  const interactiveAvenues = await loadModule()

  assert.equal(interactiveAvenues.SOURCE, 'interactiveavenues')
  assert.equal(interactiveAvenues.COMPANY, 'Interactive Avenues')
  assert.equal(interactiveAvenues.CAREERS_LANDING_URL, 'https://www.interactiveavenues.com/join-us/index.html')
  assert.equal(
    interactiveAvenues.JOBS_HUB_URL,
    'https://careers.ipgmediabrands.com/postings/?gh_search=&department=Interactive+Avenues+-+India&interest=&location=India',
  )
  assert.equal(
    interactiveAvenues.JOBS_PAGE_URL,
    'https://careers.ipgmediabrands.com/posting-greenhouse/?gh_search=&department=Interactive+Avenues+-+India&interest=&location=India',
  )
  assert.equal(
    interactiveAvenues.GREENHOUSE_JOBS_BASE_URL,
    'https://careers.ipgmediabrands.com/posting-greenhouse/',
  )
  assert.equal(
    interactiveAvenues.GREENHOUSE_BOARD_EMBED_URL,
    'https://boards.greenhouse.io/embed/job_board/js?for=mediabrands',
  )
  assert.equal(interactiveAvenues.hasOfficialCareersLandingSignal(careersLandingHtml), true)
  assert.equal(
    interactiveAvenues.extractVerifiedJobsHubUrl(careersLandingHtml),
    'https://careers.ipgmediabrands.com/postings/?gh_search=&department=Interactive+Avenues+-+India&interest=&location=India',
  )
  assert.equal(interactiveAvenues.hasOfficialJobsHubSignal(jobsHubHtml), true)
  assert.equal(
    interactiveAvenues.extractGreenhouseJobsBaseUrl(jobsHubHtml),
    'https://careers.ipgmediabrands.com/posting-greenhouse/',
  )
  assert.equal(
    interactiveAvenues.buildFilteredJobsPageUrl('https://careers.ipgmediabrands.com/posting-greenhouse/'),
    'https://careers.ipgmediabrands.com/posting-greenhouse/?gh_search=&department=Interactive+Avenues+-+India&interest=&location=India',
  )
  assert.equal(interactiveAvenues.hasOfficialJobsPageSignal(jobsPageHtml), true)
})

test('Interactive Avenues extracts verified first-party listing rows and detail pages into the shared contract', async () => {
  const interactiveAvenues = await loadModule()

  const listings = interactiveAvenues.extractListingCards(jobsPageHtml)
  assert.equal(listings.length, 1)
  assert.deepEqual(
    listings.map((listing) => ({
      title: listing.title,
      department: listing.department,
      location: listing.location,
      detailUrl: listing.detailUrl,
      jobId: listing.jobId,
    })),
    [
      {
        title: 'Media: Associate Vice President/Vice President',
        department: 'Interactive Avenues - India',
        location: 'India',
        detailUrl: 'https://careers.ipgmediabrands.com/posting-greenhouse/?gh_search=&department=Interactive+Avenues+-+India&interest=&location=India&job_id=5105985007',
        jobId: '5105985007',
      },
    ],
  )

  assert.equal(interactiveAvenues.hasOfficialJobDetailSignal(firstDetailHtml), true)
  const job = interactiveAvenues.extractJobDetail(firstDetailHtml, listings[0], {
    scrapedAt: '2026-07-16T00:00:00.000Z',
  })

  assert.deepEqual(job, {
    title: 'Media: Associate Vice President/Vice President',
    company: 'Interactive Avenues',
    department: 'Interactive Avenues - India',
    location: 'Bangalore, Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '5105985007',
    requisitionId: '26720',
    sourceUrl: 'https://careers.ipgmediabrands.com/posting-greenhouse/?gh_search=&department=Interactive+Avenues+-+India&interest=&location=India&job_id=5105985007',
    applyUrl: 'https://careers.ipgmediabrands.com/posting-greenhouse/?gh_search=&department=Interactive+Avenues+-+India&interest=&location=India&job_id=5105985007',
    employmentType: 'Regular',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription:
      'Position Summary Lead strategic media planning for major client accounts across digital channels. What You Can Expect From Interactive Avenues Work with a high-growth team that values insightful, daring and results-focused thinking.',
    remoteStatus: 'On-site',
    source: 'interactiveavenues',
    link: 'https://careers.ipgmediabrands.com/posting-greenhouse/?gh_search=&department=Interactive+Avenues+-+India&interest=&location=India&job_id=5105985007',
    scrapedAt: '2026-07-16T00:00:00.000Z',
  })
})

test('Interactive Avenues run validates the official careers handoff before scraping the first-party detail pages', async () => {
  const interactiveAvenues = await loadModule()
  const requested = []

  const jobs = await interactiveAvenues.createInteractiveAvenuesScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requested.push(url)
      if (url === interactiveAvenues.CAREERS_LANDING_URL) return careersLandingHtml
      if (url === interactiveAvenues.JOBS_HUB_URL) return jobsHubHtml
      if (url === interactiveAvenues.JOBS_PAGE_URL) return jobsPageHtml
      if (
        url
        === 'https://careers.ipgmediabrands.com/posting-greenhouse/?gh_search=&department=Interactive+Avenues+-+India&interest=&location=India&job_id=5105985007'
      ) {
        return firstDetailHtml
      }

      throw new Error(`Unexpected Interactive Avenues fixture URL: ${url}`)
    },
    now: () => '2026-07-16T00:00:00.000Z',
  })

  assert.deepEqual(requested, [
    interactiveAvenues.CAREERS_LANDING_URL,
    interactiveAvenues.JOBS_HUB_URL,
    interactiveAvenues.JOBS_PAGE_URL,
    'https://careers.ipgmediabrands.com/posting-greenhouse/?gh_search=&department=Interactive+Avenues+-+India&interest=&location=India&job_id=5105985007',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'interactiveavenues')
  assert.equal(jobs[0].company, 'Interactive Avenues')
  assert.equal(jobs[0].scrapedAt, '2026-07-16T00:00:00.000Z')
})

test('Interactive Avenues fails closed when the verified landing page, filtered board, or detail surface drifts', async () => {
  const interactiveAvenues = await loadModule()

  await assert.rejects(
    interactiveAvenues.createInteractiveAvenuesScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /Interactive Avenues careers landing page/i,
  )

  await assert.rejects(
    interactiveAvenues.createInteractiveAvenuesScraper().run({
      fetchText: async (url) => {
        if (url === interactiveAvenues.CAREERS_LANDING_URL) return careersLandingHtml
        if (url === interactiveAvenues.JOBS_HUB_URL) return '<html><body><h1>Empty page</h1></body></html>'
        throw new Error(`Unexpected Interactive Avenues fixture URL: ${url}`)
      },
    }),
    /jobs hub/i,
  )

  await assert.rejects(
    interactiveAvenues.createInteractiveAvenuesScraper({ maxJobs: 1 }).run({
      fetchText: async (url) => {
        if (url === interactiveAvenues.CAREERS_LANDING_URL) return careersLandingHtml
        if (url === interactiveAvenues.JOBS_HUB_URL) return jobsHubHtml
        if (url === interactiveAvenues.JOBS_PAGE_URL) return jobsPageHtml
        return firstDetailHtml.replace("Grnhse.Iframe.load('5105985007');", '')
      },
    }),
    /verified detail page/i,
  )
})
