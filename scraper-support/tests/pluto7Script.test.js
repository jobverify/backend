import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>JOIN OUR TEAM OF SPECIALISTS AND BRING CHANGE TO THE WORLD!</h1>
      <p>Unleash yourself and perform at your peak staying out of the box</p>
      <a href="https://pluto7.com/career-openings/">Open Positions</a>
    </main>
  </body>
</html>
`

const careerOpeningsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Find the next big job in your career!</h1>
      <div id="freshteam-widget"></div>
      <script src='https://s3.amazonaws.com/files.freshteam.com/production/30755/attachments/2000860557/original/2000015632_widget.js?1579600329'></script>
    </main>
  </body>
</html>
`

const widgetScriptHtml = `
window.onload = function() {
  var elem = document.getElementById('freshteam-widget');
  new freshTeam.JobWidget(elem,'https://pluto7.freshteam.com');
};
`

const listingHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h4>Careers - Pluto7</h4>
    <h3>Open Positions</h3>
    <div>Liquid error: undefined method 'sort_by' for nil:NilClass</div>
    <a href="/jobs/r8KWRCewwUDP/cloud-devops-and-security-engineer" class="heading" data-portal-title="clouddevopsandsecurityengineer" data-portal-location="Bengaluru, India" data-portal-job-type="2" data-portal-remote-location=false>
      <div class="row">
        <div class="job-list-info">
          <div class="job-title">Cloud DevOps and Security Engineer</div>
          <div class="job-desc text">Pluto7 is seeking a motivated and experienced Cloud DevOps and Security Engineer to join our growing team in India.</div>
        </div>
        <div class="job-location">
          <div class="location-info">
            Bengaluru, India
            <br/>
            Full Time
          </div>
        </div>
      </div>
    </a>
    <a href="/jobs/us0000000001/sales-director" class="heading" data-portal-title="salesdirector" data-portal-location="San Francisco, United States" data-portal-job-type="2" data-portal-remote-location=false>
      <div class="row">
        <div class="job-list-info">
          <div class="job-title">Sales Director</div>
          <div class="job-desc text">Lead US enterprise expansion.</div>
        </div>
        <div class="job-location">
          <div class="location-info">
            San Francisco, United States
            <br/>
            Full Time
          </div>
        </div>
      </div>
    </a>
  </body>
</html>
`

const detailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <div class="job-details">
      <h1>Cloud DevOps and Security Engineer</h1>
      <p>Bengaluru, India</p>
      <div>Work Type: Full Time</div>
      <div class="job-details-content content">
        <h3>About Pluto7</h3>
        <p>Pluto7 is a Google Cloud Premier Partner focused on delivering supply chain, machine learning, AI, and data analytics solutions.</p>
        <h3>About the Role:</h3>
        <p>Pluto7 is seeking a motivated and experienced Cloud DevOps and Security Engineer to join our growing team in India.</p>
        <h3>Responsibilities:</h3>
        <ul>
          <li>Design, build, and maintain secure cloud infrastructure.</li>
        </ul>
        <h3>Qualifications:</h3>
        <ul>
          <li>Experience: 3+ years of experience in a DevOps or related role.</li>
        </ul>
      </div>
      <a href="#applicant-form">Apply Now</a>
    </div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/pluto7/script.js')
  } catch {
    assert.fail('Expected Pluto7 scraper module at ../../scraper/pluto7/script.js')
  }
}

test('Pluto7 constants stay pinned to the verified careers pages, widget handoff, and Freshteam board', async () => {
  const pluto7 = await loadModule()

  assert.equal(pluto7.COMPANY_NAME, 'Pluto7')
  assert.equal(pluto7.SOURCE, 'pluto7')
  assert.equal(pluto7.COUNTRY_FILTER, 'India')
  assert.equal(pluto7.CAREERS_URL, 'https://pluto7.com/careers/')
  assert.equal(pluto7.OPENINGS_URL, 'https://pluto7.com/career-openings/')
  assert.equal(
    pluto7.WIDGET_SCRIPT_URL,
    'https://s3.amazonaws.com/files.freshteam.com/production/30755/attachments/2000860557/original/2000015632_widget.js?1579600329',
  )
  assert.equal(pluto7.JOBS_BOARD_URL, 'https://pluto7.freshteam.com/jobs')
  assert.equal(pluto7.LISTING_URL, 'https://pluto7.freshteam.com/jobs/search')
  assert.equal(pluto7.VERIFIED_ON, '2026-07-17')
  assert.equal(pluto7.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(pluto7.hasCareerOpeningsSignal(careerOpeningsHtml), true)
  assert.equal(
    pluto7.extractWidgetScriptUrl(careerOpeningsHtml),
    pluto7.WIDGET_SCRIPT_URL,
  )
  assert.equal(
    pluto7.extractFreshteamCompanyUrl(widgetScriptHtml),
    'https://pluto7.freshteam.com',
  )
  assert.equal(
    pluto7.buildListingUrl('https://pluto7.freshteam.com'),
    'https://pluto7.freshteam.com/jobs/search',
  )
  assert.equal(pluto7.hasOfficialJobsBoardSignal(listingHtml), true)
  assert.equal(
    pluto7.buildDetailUrl('r8KWRCewwUDP', 'cloud-devops-and-security-engineer'),
    'https://pluto7.freshteam.com/jobs/r8KWRCewwUDP/cloud-devops-and-security-engineer',
  )
})

test('Pluto7 extracts India listings from the public Freshteam search page and enriches detail pages', async () => {
  const pluto7 = await loadModule()

  const listings = pluto7.extractListingJobs(listingHtml)
  assert.equal(listings.length, 2)
  assert.deepEqual(listings[0], {
    title: 'Cloud DevOps and Security Engineer',
    summary: 'Pluto7 is seeking a motivated and experienced Cloud DevOps and Security Engineer to join our growing team in India.',
    detailUrl: 'https://pluto7.freshteam.com/jobs/r8KWRCewwUDP/cloud-devops-and-security-engineer',
    jobId: 'r8KWRCewwUDP',
    requisitionId: 'r8KWRCewwUDP',
    slug: 'cloud-devops-and-security-engineer',
    locationText: 'Bengaluru, India',
    employmentType: 'Full Time',
    remoteFlag: 'false',
  })

  const jobs = pluto7.extractSearchResults({
    listingJobs: listings,
    detailHtmlByUrl: {
      'https://pluto7.freshteam.com/jobs/r8KWRCewwUDP/cloud-devops-and-security-engineer': detailHtml,
    },
  })

  assert.deepEqual(jobs, [
    {
      title: 'Cloud DevOps and Security Engineer',
      company: 'Pluto7',
      department: null,
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: 'r8KWRCewwUDP',
      requisitionId: 'r8KWRCewwUDP',
      sourceUrl: 'https://pluto7.freshteam.com/jobs/r8KWRCewwUDP/cloud-devops-and-security-engineer',
      applyUrl: 'https://pluto7.freshteam.com/jobs/r8KWRCewwUDP/cloud-devops-and-security-engineer',
      employmentType: 'Full-time',
      experienceRequired: '3+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: [
        'About Pluto7',
        'Pluto7 is a Google Cloud Premier Partner focused on delivering supply chain, machine learning, AI, and data analytics solutions.',
        'About the Role:',
        'Pluto7 is seeking a motivated and experienced Cloud DevOps and Security Engineer to join our growing team in India.',
        'Responsibilities:',
        'Design, build, and maintain secure cloud infrastructure.',
        'Qualifications:',
        'Experience: 3+ years of experience in a DevOps or related role.',
      ].join(' '),
      remoteStatus: 'On-site',
    },
  ])
})

test('run validates Pluto7 careers handoffs before scraping the Freshteam search page and detail pages', async () => {
  const pluto7 = await loadModule()
  const requestedUrls = []

  const jobs = await pluto7.createPluto7Scraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === pluto7.CAREERS_URL) return careersHtml
      if (url === pluto7.OPENINGS_URL) return careerOpeningsHtml
      if (url === pluto7.WIDGET_SCRIPT_URL) return widgetScriptHtml
      if (url === pluto7.LISTING_URL) return listingHtml
      if (url === 'https://pluto7.freshteam.com/jobs/r8KWRCewwUDP/cloud-devops-and-security-engineer') {
        return detailHtml
      }

      throw new Error(`Unexpected Pluto7 fixture URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedUrls, [
    pluto7.CAREERS_URL,
    pluto7.OPENINGS_URL,
    pluto7.WIDGET_SCRIPT_URL,
    pluto7.LISTING_URL,
    'https://pluto7.freshteam.com/jobs/r8KWRCewwUDP/cloud-devops-and-security-engineer',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'pluto7')
  assert.equal(jobs[0].link, 'https://pluto7.freshteam.com/jobs/r8KWRCewwUDP/cloud-devops-and-security-engineer')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Pluto7 scraper fails closed when the verified careers handoff, widget contract, or jobs board signature drifts', async () => {
  const pluto7 = await loadModule()

  await assert.rejects(
    pluto7.createPluto7Scraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified Pluto7 careers page/i,
  )

  await assert.rejects(
    pluto7.createPluto7Scraper().run({
      fetchText: async (url) => {
        if (url === pluto7.CAREERS_URL) return careersHtml
        if (url === pluto7.OPENINGS_URL) {
          return careerOpeningsHtml.replace(
            '2000015632_widget.js?1579600329',
            'different-widget.js',
          )
        }

        throw new Error(`Unexpected Pluto7 fixture URL: ${url}`)
      },
    }),
    /verified Pluto7 career openings page/i,
  )

  await assert.rejects(
    pluto7.createPluto7Scraper().run({
      fetchText: async (url) => {
        if (url === pluto7.CAREERS_URL) return careersHtml
        if (url === pluto7.OPENINGS_URL) return careerOpeningsHtml
        if (url === pluto7.WIDGET_SCRIPT_URL) return widgetScriptHtml
        if (url === pluto7.LISTING_URL) {
          return '<html><body><h1>Different Careers</h1></body></html>'
        }

        throw new Error(`Unexpected Pluto7 fixture URL: ${url}`)
      },
    }),
    /verified Pluto7 Freshteam search page/i,
  )
})
