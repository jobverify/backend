import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const loadNutanixModule = async () => {
  try {
    return await import('../../scraper/nutanix/script.js')
  } catch {
    assert.fail('Expected Nutanix scraper module at ../../scraper/nutanix/script.js')
  }
}

const OFFICIAL_CAREERS_CHALLENGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Just a moment...</title>
  </head>
  <body>
    <span id="challenge-error-text">Enable JavaScript and cookies to continue</span>
    <script>window._cf_chl_opt = { cZone: 'careers.nutanix.com' }</script>
  </body>
</html>
`

const OFFICIAL_CAREERS_LIVE_BOARD_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Find your place at Nutanix. | Nutanix Careers</title>
    <link rel="canonical" href="https://careers.nutanix.com/en/jobs/">
  </head>
  <body class="js-template-jobBoard">
    <div class="site-message">
      <p><strong>Job Seeker Alert: Fraudulent Activity</strong></p>
      <a href="https://careers.nutanix.com/en/jobs/">Current Openings</a>
    </div>
    <nav>
      <a href="https://www.nutanix.com/company/careers">Life At Nutanix</a>
    </nav>
  </body>
</html>
`

const JOBVITE_HOME_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Nutanix Careers</title>
  </head>
  <body>
    <p>Powered by Jobvite</p>
    <a href="https://careers.nutanix.com/en/jobs/">Current Openings</a>
    <a href="https://www.nutanix.com/company/careers">Life At Nutanix</a>
  </body>
</html>
`

const JOBVITE_LISTINGS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h4 class="jv-featured-jobs-header">Featured Jobs</h4>
    <p class="jv-cws-sr-only">Open Positions</p>

    <h3 class="h2">Accounting & Finance</h3>
    <table class="jv-job-list">
      <tbody>
        <tr>
          <td class="jv-job-list-name">
            <a href="/nutanix/job/oAcct1">Accountant</a>
          </td>
          <td class="jv-job-list-location">Bangalore, India</td>
        </tr>
        <tr>
          <td class="jv-job-list-name">
            <a href="/nutanix/job/oUS1">Revenue Manager</a>
          </td>
          <td class="jv-job-list-location">San Jose, California</td>
        </tr>
      </tbody>
    </table>

    <h3 class="h2">Marketing</h3>
    <table class="jv-job-list">
      <tbody>
        <tr>
          <td class="jv-job-list-name">
            <a href="/nutanix/job/oMark1">Director of Field Marketing, India</a>
          </td>
          <td class="jv-job-list-location">
            <div class="jv-meta">3 Locations</div>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`

const ACCOUNTANT_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Nutanix Careers - Accountant</title>
  </head>
  <body>
    <article class="jv-page-body">
      <h2 class="jv-header">Accountant</h2>
      <p class="jv-job-detail-meta">
        Accounting & Finance
        <span class="jv-inline-separator"></span>
        Bangalore,
        India
        <span class="jv-inline-separator"></span>Req.Num.: 32001
      </p>
      <a class="jv-button jv-button-primary jv-button-apply" href="/nutanix/job/oAcct1/apply">Apply</a>
      <div class="jv-job-detail-description">
        <p>Support global accounting operations and monthly close activities.</p>
        <p><strong>What You Will Bring</strong></p>
        <ul>
          <li>5+ years of accounting experience.</li>
          <li>CA or CPA preferred.</li>
        </ul>
      </div>
    </article>
  </body>
</html>
`

const MARKETING_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Nutanix Careers - Director of Field Marketing, India</title>
  </head>
  <body>
    <article class="jv-page-body">
      <h2 class="jv-header">Director of Field Marketing, India</h2>
      <p class="jv-job-detail-meta">
        Marketing
        <span class="jv-inline-separator"></span>
        Bangalore,
        India
        <span class="jv-inline-separator"></span>
        Mumbai,
        India
        <span class="jv-inline-separator"></span>
        Delhi,
        India
        <span class="jv-inline-separator"></span>Req.Num.: 31779
      </p>
      <a class="jv-button jv-button-primary jv-button-apply" href="/nutanix/job/oMark1/apply">Apply</a>
      <div class="jv-job-detail-description">
        <p>The Opportunity</p>
        <p>Lead India marketing strategy and execution.</p>
        <ul>
          <li>15+ Years of B2B Tech Marketing Experience</li>
          <li>Exceptional communication skills</li>
        </ul>
        <p><strong>Work Arrangement</strong></p>
        <p>Hybrid: This role operates in a hybrid capacity.</p>
      </div>
    </article>
  </body>
</html>
`

test('Nutanix helpers recognize the verified Cloudflare-blocked official page and the usable public Jobvite surfaces', async () => {
  const nutanix = await loadNutanixModule()

  assert.equal(nutanix.SOURCE, 'nutanix')
  assert.equal(nutanix.COMPANY, 'Nutanix')
  assert.equal(nutanix.VERIFIED_AT, '2026-08-14')
  assert.equal(nutanix.OFFICIAL_CAREERS_URL, 'https://careers.nutanix.com/en/jobs/')
  assert.equal(nutanix.JOBVITE_HOME_URL, 'https://jobs.jobvite.com/nutanix')
  assert.equal(nutanix.JOB_LISTINGS_URL, 'https://jobs.jobvite.com/nutanix/jobs')
  assert.equal(
    nutanix.DETAIL_URL_PATTERN,
    'https://jobs.jobvite.com/nutanix/job/{jobvite_id}',
  )
  assert.equal(nutanix.isCloudflareChallengePage(OFFICIAL_CAREERS_CHALLENGE_HTML), true)
  assert.equal(nutanix.hasOfficialCareersSurfaceSignal(OFFICIAL_CAREERS_LIVE_BOARD_HTML), true)
  assert.equal(nutanix.hasJobviteHomeSignal(JOBVITE_HOME_HTML), true)
  assert.equal(nutanix.hasJobListingsSignal(JOBVITE_LISTINGS_HTML), true)

  const listings = nutanix.extractJobListings(JOBVITE_LISTINGS_HTML)
  assert.equal(listings.length, 2)
  assert.deepEqual(
    listings.map((job) => ({
      title: job.title,
      department: job.department,
      location: job.location,
      city: job.city,
      country: job.country,
      jobId: job.jobId,
      requisitionId: job.requisitionId,
      detailUrl: job.detailUrl,
    })),
    [
      {
        title: 'Accountant',
        department: 'Accounting & Finance',
        location: 'Bangalore, India',
        city: 'Bangalore',
        country: 'India',
        jobId: 'oAcct1',
        requisitionId: 'oAcct1',
        detailUrl: 'https://jobs.jobvite.com/nutanix/job/oAcct1',
      },
      {
        title: 'Director of Field Marketing, India',
        department: 'Marketing',
        location: null,
        city: null,
        country: 'India',
        jobId: 'oMark1',
        requisitionId: 'oMark1',
        detailUrl: 'https://jobs.jobvite.com/nutanix/job/oMark1',
      },
    ],
  )
})

test('Nutanix extracts Jobvite detail pages into the shared job shape, including India multi-location roles', async () => {
  const nutanix = await loadNutanixModule()

  const accountantDetail = nutanix.extractJobDetail(ACCOUNTANT_DETAIL_HTML, {
    title: 'Accountant',
    department: 'Accounting & Finance',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'oAcct1',
    requisitionId: 'oAcct1',
    detailUrl: 'https://jobs.jobvite.com/nutanix/job/oAcct1',
  })

  assert.deepEqual(accountantDetail, {
    title: 'Accountant',
    company: 'Nutanix',
    department: 'Accounting & Finance',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'oAcct1',
    requisitionId: '32001',
    sourceUrl: 'https://jobs.jobvite.com/nutanix/job/oAcct1',
    applyUrl: 'https://jobs.jobvite.com/nutanix/job/oAcct1/apply',
    employmentType: null,
    experienceRequired: '5+ years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      '5+ years of accounting experience.',
      'CA or CPA preferred.',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription:
      'Support global accounting operations and monthly close activities. What You Will Bring 5+ years of accounting experience. CA or CPA preferred.',
  })

  const marketingDetail = nutanix.extractJobDetail(MARKETING_DETAIL_HTML, {
    title: 'Director of Field Marketing, India',
    department: 'Marketing',
    location: null,
    city: null,
    country: 'India',
    jobId: 'oMark1',
    requisitionId: 'oMark1',
    detailUrl: 'https://jobs.jobvite.com/nutanix/job/oMark1',
  })

  assert.equal(marketingDetail.title, 'Director of Field Marketing, India')
  assert.equal(marketingDetail.department, 'Marketing')
  assert.equal(marketingDetail.location, 'Bangalore, India | Mumbai, India | Delhi, India')
  assert.equal(marketingDetail.city, 'Bangalore')
  assert.equal(marketingDetail.country, 'India')
  assert.equal(marketingDetail.jobId, 'oMark1')
  assert.equal(marketingDetail.requisitionId, '31779')
  assert.equal(marketingDetail.applyUrl, 'https://jobs.jobvite.com/nutanix/job/oMark1/apply')
  assert.equal(marketingDetail.sourceUrl, 'https://jobs.jobvite.com/nutanix/job/oMark1')
  assert.equal(marketingDetail.experienceRequired, '15+ Years')
  assert.match(marketingDetail.jobDescription, /Lead India marketing strategy/i)
  assert.ok(marketingDetail.requiredSkills.includes('15+ Years of B2B Tech Marketing Experience'))
})

test('Nutanix run tolerates the official Cloudflare challenge and returns India roles from the public Jobvite board', async () => {
  const nutanix = await loadNutanixModule()
  const pageRequests = []
  const textRequests = []
  const scraper = nutanix.createNutanixScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      pageRequests.push(url)

      if (url === nutanix.OFFICIAL_CAREERS_URL) {
        return { status: 403, url, finalUrl: url, html: OFFICIAL_CAREERS_CHALLENGE_HTML, errorKind: null }
      }

      throw new Error(`Unexpected Nutanix page URL: ${url}`)
    },
    fetchText: async (url) => {
      textRequests.push(url)

      if (url === nutanix.JOBVITE_HOME_URL) return JOBVITE_HOME_HTML
      if (url === nutanix.JOB_LISTINGS_URL) return JOBVITE_LISTINGS_HTML
      if (url === 'https://jobs.jobvite.com/nutanix/job/oAcct1') return ACCOUNTANT_DETAIL_HTML
      if (url === 'https://jobs.jobvite.com/nutanix/job/oMark1') return MARKETING_DETAIL_HTML

      throw new Error(`Unexpected Nutanix URL: ${url}`)
    },
  })

  assert.deepEqual(pageRequests, [
    nutanix.OFFICIAL_CAREERS_URL,
  ])
  assert.deepEqual(textRequests, [
    nutanix.JOBVITE_HOME_URL,
    nutanix.JOB_LISTINGS_URL,
    'https://jobs.jobvite.com/nutanix/job/oAcct1',
    'https://jobs.jobvite.com/nutanix/job/oMark1',
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.city, job.source, job.link, job.scrapedAt]),
    [
      [
        'Accountant',
        'Bangalore',
        'nutanix',
        'https://jobs.jobvite.com/nutanix/job/oAcct1/apply',
        FIXED_SCRAPED_AT,
      ],
      [
        'Director of Field Marketing, India',
        'Bangalore',
        'nutanix',
        'https://jobs.jobvite.com/nutanix/job/oMark1/apply',
        FIXED_SCRAPED_AT,
      ],
    ],
  )
})

test('Nutanix can proceed when the official careers route responds with the verified 403 challenge page', async () => {
  const nutanix = await loadNutanixModule()
  const pageRequests = []

  const jobs = await nutanix.createNutanixScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchPage: async (url) => {
      pageRequests.push(url)

      if (url === nutanix.OFFICIAL_CAREERS_URL) {
        return { status: 403, url, finalUrl: url, html: OFFICIAL_CAREERS_CHALLENGE_HTML, errorKind: null }
      }

      throw new Error(`Unexpected Nutanix page URL: ${url}`)
    },
    fetchText: async (url) => {
      if (url === nutanix.JOBVITE_HOME_URL) return JOBVITE_HOME_HTML
      if (url === nutanix.JOB_LISTINGS_URL) return JOBVITE_LISTINGS_HTML
      if (url === 'https://jobs.jobvite.com/nutanix/job/oAcct1') return ACCOUNTANT_DETAIL_HTML
      if (url === 'https://jobs.jobvite.com/nutanix/job/oMark1') return MARKETING_DETAIL_HTML

      throw new Error(`Unexpected Nutanix text URL: ${url}`)
    },
  })

  assert.deepEqual(pageRequests, [
    nutanix.OFFICIAL_CAREERS_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Accountant')
  assert.equal(jobs[1].title, 'Director of Field Marketing, India')
})

test('Nutanix fails closed when the official careers challenge page drifts away from the verified Cloudflare contract', async () => {
  const nutanix = await loadNutanixModule()

  await assert.rejects(
    nutanix.createNutanixScraper({
      now: () => FIXED_SCRAPED_AT,
    }).run({
      fetchPage: async (url) => ({
        status: 403,
        url,
        finalUrl: url,
        html: '<html><body><h1>Forbidden</h1></body></html>',
        errorKind: null,
      }),
      fetchText: async () => {
        throw new Error('Unexpected Jobvite fetch')
      },
    }),
    /official careers page/i,
  )
})

test('Nutanix fails closed when the public Jobvite bridge stops matching the verified surface', async () => {
  const nutanix = await loadNutanixModule()

  await assert.rejects(
    nutanix.createNutanixScraper().run({
      fetchPage: async (url) => ({
        status: 403,
        url,
        finalUrl: url,
        html: OFFICIAL_CAREERS_CHALLENGE_HTML,
        errorKind: null,
      }),
      fetchText: async (url) => {
        if (url === nutanix.JOBVITE_HOME_URL) return '<html><body><h1>Nutanix</h1></body></html>'

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Jobvite home/i,
  )

  await assert.rejects(
    nutanix.createNutanixScraper().run({
      fetchPage: async (url) => ({
        status: 403,
        url,
        finalUrl: url,
        html: OFFICIAL_CAREERS_CHALLENGE_HTML,
        errorKind: null,
      }),
      fetchText: async (url) => {
        if (url === nutanix.JOBVITE_HOME_URL) return JOBVITE_HOME_HTML
        if (url === nutanix.JOB_LISTINGS_URL) return '<html><body><h1>Jobs</h1></body></html>'

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Jobvite listings/i,
  )
})
