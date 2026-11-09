import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-25T00:00:00.000Z'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Clari5</title>
    <link rel="canonical" href="https://www.clari5.com/">
  </head>
  <body>
    <a href="https://www.clari5.com/careers/">Careers</a>
    <p>Fraud detection</p>
    <p>AML</p>
  </body>
</html>
`

const archiveHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs - Clari5</title>
    <link rel="canonical" href="https://www.clari5.com/careers/">
    <link rel="alternate" type="application/rss+xml" href="https://www.clari5.com/careers/feed/">
  </head>
  <body class="post-type-archive-jobpost">
    <script src="https://www.clari5.com/wp-content/plugins/simple-job-board/public/js/simple-job-board-public.js"></script>
    <div class="sjb-listing"></div>
    <div class="sjb-search-location"></div>
    <div class="v2 sjb-job-123">
      <a href="https://www.clari5.com/careers/software-engineer/">
        <span class="job-title">Software Engineer</span>
      </a>
      <div class="job-type"><i></i>Full Time</div>
      <div class="job-location"><i></i>Bangalore, India</div>
      <div class="job-date"><i></i>July 20, 2026</div>
      <div class="job-description-list">
        <div id="sjb_less_content_123"><p>Apply Now</p></div>
      </div>
    </div>
  </body>
</html>
`

const detailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Software Engineer - Clari5</title>
    <link rel="canonical" href="https://www.clari5.com/careers/software-engineer/">
  </head>
  <body class="single-jobpost">
    <form class="jobpost-form sjb-job-detail-123" id="sjb-application-form">
      <input type="hidden" name="action" value="process_applicant_form">
      <input type="hidden" name="job_id" value="123">
    </form>
    <div class="job-location"><i></i>Bangalore, India</div>
    <div class="job-type"><i></i>Full Time</div>
    <div class="job-date"><i></i>July 20, 2026</div>
    <div class="job-description">
      <p>Department</p>
      <p>Engineering</p>
      <p>Experience</p>
      <p>5 - 8 years</p>
      <ul>
        <li>Build fraud detection workflows</li>
        <li>Work with transaction monitoring systems</li>
      </ul>
    </div>
    <div class="clearfix"></div>
    <h2>Apply For This Job</h2>
  </body>
</html>
`

const currentEmptyArchiveHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact Forms - Clari5</title>
    <meta name="description" content="Jobs Archive - Clari5">
    <link rel="canonical" href="https://www.clari5.com/careers/">
  </head>
  <body class="archive post-type-archive post-type-archive-jobpost">
    <script src="https://www.clari5.com/wp-content/plugins/simple-job-board/public/js/simple-job-board-public.js"></script>
    <div class="sjb-page">
      <div class="sjb-listing">
        <div class="list-view">
          <div class="no-job-listing">
            <p class="no-job-listing-text">No jobs found</p>
          </div>
        </div>
      </div>
      <h2>apply now</h2>
    </div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/clari5/script.js')
  } catch {
    assert.fail('Expected Clari5 scraper module at ../../scraper/clari5/script.js')
  }
}

test('Clari5 parses the verified archive and detail surfaces for India roles', async () => {
  const clari5 = await loadModule()

  assert.equal(clari5.SOURCE, 'clari5')
  assert.equal(clari5.COMPANY, 'Clari5')
  assert.equal(clari5.HOMEPAGE_URL, 'https://www.clari5.com/')
  assert.equal(clari5.CAREERS_URL, 'https://www.clari5.com/careers/')
  assert.equal(clari5.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(clari5.hasOfficialCareersPageSignal(archiveHtml), true)
  assert.deepEqual(clari5.extractArchiveListings(archiveHtml), [
    {
      jobId: '123',
      title: 'Software Engineer',
      sourceUrl: 'https://www.clari5.com/careers/software-engineer/',
      employmentType: 'Full Time',
      location: 'Bangalore, India',
      postedText: 'July 20, 2026',
      category: null,
      excerpt: 'Apply Now',
    },
  ])

  const detail = clari5.extractJobDetail(detailHtml, clari5.extractArchiveListings(archiveHtml)[0])
  assert.equal(detail.title, 'Software Engineer')
  assert.equal(detail.location, 'Bangalore, India')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, '123')
})

test('Clari5 returns [] when the current official archive shows an explicit no-jobs state', async () => {
  const clari5 = await loadModule()

  assert.equal(clari5.hasOfficialCareersPageSignal(currentEmptyArchiveHtml), true)
  assert.deepEqual(clari5.extractArchiveListings(currentEmptyArchiveHtml), [])

  const jobs = await clari5.createClari5Scraper().run({
    now: () => FIXED_SCRAPED_AT,
    fetchText: async (url) => {
      if (url === clari5.HOMEPAGE_URL) return homepageHtml
      if (url === clari5.CAREERS_URL) return currentEmptyArchiveHtml
      throw new Error(`Unexpected Clari5 URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})
