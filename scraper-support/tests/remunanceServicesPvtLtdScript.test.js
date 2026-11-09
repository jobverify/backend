import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Best Employer of Record (EOR) Services Provider India</title>
    <link rel="canonical" href="https://remunance.com/">
  </head>
  <body>
    <a href="https://remunance.com/jobs/">Careers</a>
    <footer>
      <h4>Remunance Services Pvt Ltd</h4>
      <a href="https://www.linkedin.com/company/remunance">LinkedIn</a>
    </footer>
  </body>
</html>
`

const LISTING_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Job Openings Archive - Remunance</title>
    <link rel="canonical" href="https://remunance.com/jobs/">
  </head>
  <body>
    <main>
      <h1>Job Openings</h1>
      <div class="awsm-job-listings awsm-row awsm-grid-col-3">
        <div class="awsm-job-listing-item awsm-grid-item" id="awsm-grid-item-13246">
          <a href="https://remunance.com/jobs/new-product-introduction-buyer" class="awsm-job-item">
            <div class="awsm-grid-left-col">
              <h2 class="awsm-job-post-title">New Product Introduction Buyer</h2>
            </div>
            <div class="awsm-grid-right-col">
              <div class="awsm-job-more-container"><span class="awsm-job-more">More Details</span></div>
            </div>
          </a>
        </div>
        <div class="awsm-job-listing-item awsm-grid-item" id="awsm-grid-item-14001">
          <a href="https://remunance.com/jobs/supply-continuity-analyst" class="awsm-job-item">
            <div class="awsm-grid-left-col">
              <h2 class="awsm-job-post-title">Supply Continuity Analyst</h2>
            </div>
            <div class="awsm-grid-right-col">
              <div class="awsm-job-more-container"><span class="awsm-job-more">More Details</span></div>
            </div>
          </a>
        </div>
      </div>
      <div class="awsm-jobs-pagination awsm-load-more-main">
        <a href="#" class="awsm-load-more awsm-load-more-btn" data-page="1">Load more...</a>
      </div>
    </main>
    <footer>
      <h4>Remunance Services Pvt Ltd</h4>
    </footer>
  </body>
</html>
`

const DETAIL_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>New Product Introduction Buyer - Remunance</title>
    <link rel="canonical" href="https://remunance.com/jobs/new-product-introduction-buyer/">
    <meta property="og:site_name" content="Remunance">
  </head>
  <body>
    <main>
      <article>
        <h1 class="title entry-title">New Product Introduction Buyer</h1>
        <ul class="nv-meta-list">
          <li class="meta date posted-on nv-show-updated last">
            <time class="updated" datetime="2026-05-18T10:52:39+00:00">May 18, 2026</time>
          </li>
        </ul>
        <div class="awsm-job-entry-content entry-content">
          <h3><strong>Greetings from Remunance</strong>!</h3>
          <figure class="wp-block-table">
            <table class="has-fixed-layout">
              <tbody>
                <tr><td><strong>1</strong></td><td><strong>No of Position</strong></td><td><strong>1</strong></td></tr>
                <tr><td><strong>2</strong></td><td><strong>Experience</strong></td><td><strong>3+ years</strong></td></tr>
                <tr><td><strong>3</strong></td><td><strong>Designation</strong></td><td><strong>New Product Introduction Buyer</strong></td></tr>
                <tr><td><strong>4</strong></td><td><strong>Shift Timings</strong></td><td><strong>09:00 AM - 06:00 PM</strong></td></tr>
                <tr><td><strong>5</strong></td><td><strong>Location</strong></td><td><strong>Pune</strong></td></tr>
              </tbody>
            </table>
          </figure>
          <p><strong>Job Description</strong><br><br><strong>Main responsibilities:</strong></p>
          <p>New Product Introduction Buyer will be performing the following responsibilities and duties:</p>
          <ul>
            <li>Manage new parts and part changes from quote to customer approval and shipment</li>
            <li>Place POs based on company guidelines and obtain PO approvals.</li>
          </ul>
          <p><strong>Key Competencies:</strong></p>
          <p>Strategic Vision.</p>
          <p>Results driven.</p>
          <p><strong>Skills and Qualifications:</strong></p>
          <p>Excellent computer skills and proficiency with Microsoft Office Excel and Word.</p>
          <p>Demonstrable analytical and problem-solving skills.</p>
        </div>
        <div class="awsm-job-form">
          <div class="awsm-job-form-inner">
            <h2>Apply for this position</h2>
            <form id="awsm-application-form"></form>
          </div>
        </div>
      </article>
    </main>
    <footer>
      <h4>Remunance Services Pvt Ltd</h4>
    </footer>
  </body>
</html>
`

const SECOND_DETAIL_HTML = DETAIL_HTML
  .replace(/New Product Introduction Buyer/g, 'Supply Continuity Analyst')
  .replace('https://remunance.com/jobs/new-product-introduction-buyer/', 'https://remunance.com/jobs/supply-continuity-analyst/')
  .replace('2026-05-18T10:52:39+00:00', '2026-05-18T10:41:30+00:00')
  .replace('<strong>1</strong></td></tr>', '<strong>2</strong></td></tr>')
  .replace('<strong>3+ years</strong>', '<strong>3-5 years</strong>')
  .replace('09:00 AM - 06:00 PM', '6:00pm - 3:00 am')
  .replace('Manage new parts and part changes from quote to customer approval and shipment', 'Prepare, analyze, and action Days On Hand supply reports to identify and resolve potential supply gaps.')
  .replace('Place POs based on company guidelines and obtain PO approvals.', 'Monitor trends in data and vendor performance to anticipate and resolve issues proactively.')

const loadRemunanceModule = async () => {
  try {
    return await import('../../scraper/remunanceservicespvtltd/script.js')
  } catch {
    assert.fail('Expected Remunance Services Pvt. Ltd. scraper module at ../../scraper/remunanceservicespvtltd/script.js')
  }
}

test('extractJobCards maps the Remunance first-party jobs archive cards', async () => {
  const remunance = await loadRemunanceModule()

  assert.equal(remunance.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(remunance.hasJobsPageSignal(LISTING_HTML), true)
  assert.deepEqual(remunance.extractJobCards(LISTING_HTML), [
    {
      title: 'New Product Introduction Buyer',
      company: 'Remunance Services Pvt. Ltd.',
      department: null,
      location: null,
      city: null,
      country: 'India',
      jobId: '13246',
      requisitionId: '13246',
      sourceUrl: 'https://remunance.com/jobs/new-product-introduction-buyer/',
      applyUrl: 'https://remunance.com/jobs/new-product-introduction-buyer/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Supply Continuity Analyst',
      company: 'Remunance Services Pvt. Ltd.',
      department: null,
      location: null,
      city: null,
      country: 'India',
      jobId: '14001',
      requisitionId: '14001',
      sourceUrl: 'https://remunance.com/jobs/supply-continuity-analyst/',
      applyUrl: 'https://remunance.com/jobs/supply-continuity-analyst/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
  ])
})

test('Remunance accepts the current brand-prefixed homepage title while retaining company identity', async () => {
  const remunance = await loadRemunanceModule()
  assert.equal(
    remunance.hasOfficialHomepageSignal(HOMEPAGE_HTML.replace(
      '<title>Best Employer of Record (EOR) Services Provider India</title>',
      '<title>Remunance | Best Employer of Record Services Provider India</title>',
    )),
    true,
  )
})

test('Remunance reports a 200 Cloudflare block as an upstream challenge', async () => {
  const remunance = await loadRemunanceModule()
  await assert.rejects(
    remunance.run({ fetchText: async () => '<title>Attention Required! | Cloudflare</title><h1>Sorry, you have been blocked</h1><p>Cloudflare Ray ID: abc</p>' }),
    (error) => error?.code === 'REMUNANCE_ACCESS_CHALLENGE' && error?.upstreamOutage === true,
  )
})

test('extractJobDetail reads the Remunance detail table, posting date, and inline apply form', async () => {
  const remunance = await loadRemunanceModule()

  const detail = remunance.extractJobDetail(DETAIL_HTML, {
    title: 'New Product Introduction Buyer',
    company: 'Remunance Services Pvt. Ltd.',
    department: null,
    location: null,
    city: null,
    country: 'India',
    jobId: '13246',
    requisitionId: '13246',
    sourceUrl: 'https://remunance.com/jobs/new-product-introduction-buyer/',
    applyUrl: 'https://remunance.com/jobs/new-product-introduction-buyer/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: 'On-site',
  })

  assert.deepEqual(detail, {
    title: 'New Product Introduction Buyer',
    company: 'Remunance Services Pvt. Ltd.',
    department: null,
    location: 'Pune, India',
    city: 'Pune',
    country: 'India',
    jobId: '13246',
    requisitionId: '13246',
    sourceUrl: 'https://remunance.com/jobs/new-product-introduction-buyer/',
    applyUrl: 'https://remunance.com/jobs/new-product-introduction-buyer/',
    employmentType: null,
    experienceRequired: '3+ years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Manage new parts and part changes from quote to customer approval and shipment',
      'Place POs based on company guidelines and obtain PO approvals.',
      'Strategic Vision.',
      'Results driven.',
      'Excellent computer skills and proficiency with Microsoft Office Excel and Word.',
      'Demonstrable analytical and problem-solving skills.',
    ],
    postingDate: '2026-05-18',
    closingDate: null,
    jobDescription: 'Main responsibilities: New Product Introduction Buyer will be performing the following responsibilities and duties: Manage new parts and part changes from quote to customer approval and shipment Place POs based on company guidelines and obtain PO approvals. Key Competencies: Strategic Vision. Results driven. Skills and Qualifications: Excellent computer skills and proficiency with Microsoft Office Excel and Word. Demonstrable analytical and problem-solving skills.',
    remoteStatus: 'On-site',
  })
})

test('extractJobDetail accepts legacy Remunance archive slugs when the live detail page rewrites to a verified first-party canonical URL', async () => {
  const remunance = await loadRemunanceModule()

  const redirectedDetail = remunance.extractJobDetail(DETAIL_HTML, {
    title: 'New Product Introduction Buyer',
    company: 'Remunance Services Pvt. Ltd.',
    department: null,
    location: null,
    city: null,
    country: 'India',
    jobId: '13246',
    requisitionId: '13246',
    sourceUrl: 'https://remunance.com/jobs/piping-detailer-senior-6/',
    applyUrl: 'https://remunance.com/jobs/piping-detailer-senior-6/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: 'On-site',
  })

  assert.equal(redirectedDetail.sourceUrl, 'https://remunance.com/jobs/new-product-introduction-buyer/')
  assert.equal(redirectedDetail.applyUrl, 'https://remunance.com/jobs/new-product-introduction-buyer/')
  assert.equal(redirectedDetail.title, 'New Product Introduction Buyer')
})

test('run uses browser-backed first-party HTML when direct HTTP access is blocked', async () => {
  const remunance = await loadRemunanceModule()
  const attempts = []

  const jobs = await remunance.createRemunanceServicesPvtLtdScraper().run({
    fetchText: async (url) => {
      attempts.push(`http:${url}`)
      throw new Error(`HTTP 403 for ${url}`)
    },
    fetchBrowserText: async (url) => {
      attempts.push(`browser:${url}`)
      if (url === remunance.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === 'https://remunance.com/jobs/new-product-introduction-buyer/') return DETAIL_HTML
      if (url === 'https://remunance.com/jobs/supply-continuity-analyst/') return SECOND_DETAIL_HTML
      throw new Error(`Unexpected browser detail URL: ${url}`)
    },
    fetchBrowserListingHtml: async () => {
      attempts.push(`browser:${remunance.JOBS_URL}:listing`)
      return LISTING_HTML
    },
    now: () => '2026-07-11T05:55:00.000Z',
  })

  assert.deepEqual(attempts, [
    `http:${remunance.HOMEPAGE_URL}`,
    `browser:${remunance.HOMEPAGE_URL}`,
    `http:${remunance.JOBS_URL}`,
    `browser:${remunance.JOBS_URL}:listing`,
    'http:https://remunance.com/jobs/new-product-introduction-buyer/',
    'browser:https://remunance.com/jobs/new-product-introduction-buyer/',
    'http:https://remunance.com/jobs/supply-continuity-analyst/',
    'browser:https://remunance.com/jobs/supply-continuity-analyst/',
  ])

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'remunanceservicespvtltd')
  assert.equal(jobs[0].company, 'Remunance Services Pvt. Ltd.')
  assert.equal(jobs[0].link, 'https://remunance.com/jobs/new-product-introduction-buyer/')
  assert.equal(jobs[0].scrapedAt, '2026-07-11T05:55:00.000Z')
  assert.equal(jobs[1].location, 'Pune, India')
  assert.equal(jobs[1].experienceRequired, '3-5 years')
})

test('run also uses browser-backed first-party HTML when direct HTTP access is rate-limited', async () => {
  const remunance = await loadRemunanceModule()
  const attempts = []

  const jobs = await remunance.createRemunanceServicesPvtLtdScraper().run({
    fetchText: async (url) => {
      attempts.push(`http:${url}`)
      throw new Error(`HTTP 429 for ${url}`)
    },
    fetchBrowserText: async (url) => {
      attempts.push(`browser:${url}`)
      if (url === remunance.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === 'https://remunance.com/jobs/new-product-introduction-buyer/') return DETAIL_HTML
      if (url === 'https://remunance.com/jobs/supply-continuity-analyst/') return SECOND_DETAIL_HTML
      throw new Error(`Unexpected browser detail URL: ${url}`)
    },
    fetchBrowserListingHtml: async () => {
      attempts.push(`browser:${remunance.JOBS_URL}:listing`)
      return LISTING_HTML
    },
    now: () => '2026-07-11T05:55:00.000Z',
  })

  assert.deepEqual(attempts, [
    `http:${remunance.HOMEPAGE_URL}`,
    `browser:${remunance.HOMEPAGE_URL}`,
    `http:${remunance.JOBS_URL}`,
    `browser:${remunance.JOBS_URL}:listing`,
    'http:https://remunance.com/jobs/new-product-introduction-buyer/',
    'browser:https://remunance.com/jobs/new-product-introduction-buyer/',
    'http:https://remunance.com/jobs/supply-continuity-analyst/',
    'browser:https://remunance.com/jobs/supply-continuity-analyst/',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'remunanceservicespvtltd')
})
