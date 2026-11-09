import assert from 'node:assert/strict'
import test from 'node:test'

const loadStartGenieModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected StartGenie scraper module at ./script.js')
  }
}

const HOMEPAGE_HTML = `
  <html lang="en">
    <head>
      <title>StartGenie: Digital Marketing Agency in India</title>
      <meta
        name="description"
        content="StartGenie is a digital marketing agency offering social media marketing, website &amp; app development, and paid ads to grow businesses online."
      />
    </head>
    <body>
      <nav>
        <a href="https://startgenie.co.in/about-us/">About</a>
        <a href="https://startgenie.co.in/careers/" class="ekit-menu-nav-link">Careers</a>
      </nav>
      <main>
        <h1>StartGenie</h1>
        <h2>Transform Your Brand - Let's Connect!</h2>
        <p>Digital Marketing Agency in India</p>
      </main>
    </body>
  </html>
`

const CAREERS_HTML = `
  <html lang="en">
    <head>
      <title>Careers - StartGenie</title>
      <meta
        property="og:description"
        content="Careers Be part of our mission We're seeking passionate and talented individuals to help us achieve our goals."
      />
      <link
        rel="stylesheet"
        id="awsm-jobs-style-css"
        href="https://startgenie.co.in/wp-content/plugins/wp-job-openings/assets/css/style.min.css?ver=3.6.0"
      />
    </head>
    <body class="listing-page-awsm_job_openings">
      <section>
        <h2>Be part of our mission</h2>
        <p>We're seeking passionate and talented individuals to help us achieve our goals.</p>
      </section>
      <div class="awsm-job-listing-item awsm-job-expired-item awsm-grid-item" id="awsm-grid-item-2772">
        <a href="https://startgenie.co.in/?post_type=awsm_job_openings&#038;p=2772" class="awsm-job-item">
          <div class="awsm-grid-left-col">
            <h2 class="awsm-job-post-title">Event Coordination &amp; Operations Internship</h2>
          </div>
          <div class="awsm-grid-right-col">
            <div class="awsm-job-specification-wrapper">
              <div class="awsm-job-specification-item awsm-job-specification-job-category">
                <span class="awsm-job-specification-term">Operations</span>
              </div>
              <div class="awsm-job-specification-item awsm-job-specification-job-location">
                <span class="awsm-job-specification-term">Hybrid</span>
              </div>
            </div>
          </div>
        </a>
      </div>
      <div class="awsm-job-listing-item awsm-grid-item" id="awsm-grid-item-2771">
        <a href="https://startgenie.co.in/jobs/video-production-internship/" class="awsm-job-item">
          <div class="awsm-grid-left-col">
            <h2 class="awsm-job-post-title">Video Production Internship</h2>
          </div>
          <div class="awsm-grid-right-col">
            <div class="awsm-job-specification-wrapper">
              <div class="awsm-job-specification-item awsm-job-specification-job-category">
                <span class="awsm-job-specification-term">Videography</span>
              </div>
              <div class="awsm-job-specification-item awsm-job-specification-job-location">
                <span class="awsm-job-specification-term">Bangalore</span>
                <span class="awsm-job-specification-term">Hybrid</span>
              </div>
            </div>
          </div>
        </a>
      </div>
      <div class="awsm-job-listing-item awsm-grid-item" id="awsm-grid-item-2770">
        <a href="https://startgenie.co.in/jobs/digital-marketing-internship-startgenie-x-trigunita-ed-techclient-acquisition-internship-performance-based/" class="awsm-job-item">
          <div class="awsm-grid-left-col">
            <h2 class="awsm-job-post-title">Digital Marketing Internship - StartGenie x Trigunita Ed Tech</h2>
          </div>
          <div class="awsm-grid-right-col">
            <div class="awsm-job-specification-wrapper">
              <div class="awsm-job-specification-item awsm-job-specification-job-category">
                <span class="awsm-job-specification-term">Marketing and Sales</span>
              </div>
              <div class="awsm-job-specification-item awsm-job-specification-job-location">
                <span class="awsm-job-specification-term">Remote</span>
              </div>
            </div>
          </div>
        </a>
      </div>
      <div class="awsm-job-listing-item awsm-grid-item" id="awsm-grid-item-2769">
        <a href="https://startgenie.co.in/jobs/client-acquisition-internship-performance-based/" class="awsm-job-item">
          <div class="awsm-grid-left-col">
            <h2 class="awsm-job-post-title">Client Acquisition Internship (Performance-Based)</h2>
          </div>
          <div class="awsm-grid-right-col">
            <div class="awsm-job-specification-wrapper">
              <div class="awsm-job-specification-item awsm-job-specification-job-category">
                <span class="awsm-job-specification-term">Marketing and Sales</span>
              </div>
              <div class="awsm-job-specification-item awsm-job-specification-job-location">
                <span class="awsm-job-specification-term">Hybrid</span>
                <span class="awsm-job-specification-term">Remote</span>
              </div>
            </div>
          </div>
        </a>
      </div>
      <div class="awsm-job-listing-item awsm-grid-item" id="awsm-grid-item-2756">
        <a href="https://startgenie.co.in/jobs/graphic-designer-canva-specialist-visual-video-content/" class="awsm-job-item">
          <div class="awsm-grid-left-col">
            <h2 class="awsm-job-post-title">Graphic Designer - Canva Specialist (Visual &amp; Video Content)</h2>
          </div>
          <div class="awsm-grid-right-col">
            <div class="awsm-job-specification-wrapper">
              <div class="awsm-job-specification-item awsm-job-specification-job-category">
                <span class="awsm-job-specification-term">Graphic Designer</span>
              </div>
              <div class="awsm-job-specification-item awsm-job-specification-job-location">
                <span class="awsm-job-specification-term">Remote</span>
              </div>
            </div>
          </div>
        </a>
      </div>
    </body>
  </html>
`

const JOB_SITEMAP_XML = `
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
      <loc>https://startgenie.co.in/jobs/digital-marketing-internship-startgenie-x-trigunita-ed-techclient-acquisition-internship-performance-based/</loc>
    </url>
    <url>
      <loc>https://startgenie.co.in/jobs/video-production-internship/</loc>
    </url>
    <url>
      <loc>https://startgenie.co.in/jobs/graphic-designer-canva-specialist-visual-video-content/</loc>
    </url>
    <url>
      <loc>https://startgenie.co.in/jobs/client-acquisition-internship-performance-based/</loc>
    </url>
  </urlset>
`

const createJobDetailHtml = ({
  title,
  category,
  employmentType,
  locations,
  datePosted,
  description,
}) => {
  const jobPosting = {
    '@context': 'http://schema.org/',
    '@type': 'JobPosting',
    title,
    description,
    datePosted,
    hiringOrganization: {
      '@type': 'Organization',
      name: 'Start Genie',
      sameAs: 'https://startgenie.co.in',
    },
    employmentType: [],
    jobLocation: locations.map((address) => ({
      '@type': 'Place',
      address,
    })),
  }

  const locationTerms = locations
    .map((value) => `<span class="awsm-job-specification-term">${value}</span>`)
    .join('')

  return `
    <html lang="en">
      <head>
        <title>${title} - StartGenie</title>
      </head>
      <body>
        <div class="awsm-job-container">
          <div class="awsm-job-head">
            <h1 class="entry-title awsm-jobs-single-title">${title}</h1>
          </div>
          <div class="awsm-job-specification-wrapper">
            <div class="awsm-job-specification-item awsm-job-specification-job-category">
              <span class="awsm-job-specification-label"><strong>Job Category: </strong></span>
              <span class="awsm-job-specification-term">${category}</span>
            </div>
            <div class="awsm-job-specification-item awsm-job-specification-job-type">
              <span class="awsm-job-specification-label"><strong>Job Type: </strong></span>
              <span class="awsm-job-specification-term">${employmentType}</span>
            </div>
            <div class="awsm-job-specification-item awsm-job-specification-job-location">
              <span class="awsm-job-specification-label"><strong>Job Location: </strong></span>
              ${locationTerms}
            </div>
          </div>
          <script type="application/ld+json">${JSON.stringify(jobPosting)}</script>
          <form id="awsm-application-form" class="awsm-application-form"></form>
        </div>
      </body>
    </html>
  `
}

const JOB_DETAIL_HTML_BY_URL = {
  'https://startgenie.co.in/jobs/video-production-internship/': createJobDetailHtml({
    title: 'Video Production Internship',
    category: 'Videography',
    employmentType: 'Internship',
    locations: ['Bangalore', 'Hybrid'],
    datePosted: '2025-05-20T07:00:12+05:30',
    description: `
      <p><strong>About Us:</strong></p>
      <p>StartGenie is looking for enthusiastic Videography &amp; Editing interns.</p>
      <p><strong>Key Responsibilities:</strong></p>
      <ul>
        <li>Handle videography for campaigns.</li>
        <li>Edit social media assets.</li>
      </ul>
      <p><strong>Skills Required:</strong></p>
      <p>Video editing tools and creative storytelling.</p>
      <p>Let's create something amazing together! Apply now!</p>
    `,
  }),
  'https://startgenie.co.in/jobs/digital-marketing-internship-startgenie-x-trigunita-ed-techclient-acquisition-internship-performance-based/': createJobDetailHtml({
    title: 'Digital Marketing Internship - StartGenie x Trigunita Ed Tech',
    category: 'Marketing and Sales',
    employmentType: 'Internship',
    locations: ['Remote'],
    datePosted: '2025-05-20T06:55:05+05:30',
    description: `
      <p><strong>About Us:</strong></p>
      <p>StartGenie and Trigunita Ed Tech are offering a virtual internship.</p>
      <p><strong>What You'll Gain:</strong></p>
      <ul>
        <li>Practical exposure to branding strategy.</li>
      </ul>
      <p><strong>Skills Required:</strong></p>
      <p>Communication and content marketing basics.</p>
      <p>Apply now and take your first step towards a dynamic career in marketing.</p>
    `,
  }),
  'https://startgenie.co.in/jobs/client-acquisition-internship-performance-based/': createJobDetailHtml({
    title: 'Client Acquisition Internship (Performance-Based)',
    category: 'Marketing and Sales',
    employmentType: 'Internship',
    locations: ['Hybrid', 'Remote'],
    datePosted: '2025-05-20T06:48:14+05:30',
    description: `
      <p><strong>Duration:</strong> 2 Months</p>
      <p><strong>About Us:</strong></p>
      <p>StartGenie is a fast-growing digital marketing agency helping brands scale.</p>
      <p><strong>Key Responsibilities:</strong></p>
      <ul>
        <li>Identify and reach out to potential leads.</li>
        <li>Maintain a record of outreach, responses, and conversions.</li>
      </ul>
      <p><strong>Skills Required:</strong></p>
      <p>Strong follow-up and negotiation skills.</p>
      <p>Ready to grow with us? Apply now.</p>
    `,
  }),
  'https://startgenie.co.in/jobs/graphic-designer-canva-specialist-visual-video-content/': createJobDetailHtml({
    title: 'Graphic Designer - Canva Specialist (Visual & Video Content)',
    category: 'Graphic Designer',
    employmentType: 'Full Time',
    locations: ['Remote'],
    datePosted: '2025-05-20T07:01:38+05:30',
    description: `
      <p><strong>About Us:</strong></p>
      <p>StartGenie is hiring a graphic designer for visual and video content.</p>
      <p><strong>Key Responsibilities:</strong></p>
      <ul>
        <li>Create engaging visual assets for campaigns.</li>
      </ul>
      <p><strong>Skills Required:</strong></p>
      <p>Canva, design systems, and motion-ready social content.</p>
      <p>Apply now and build standout creative work with us.</p>
    `,
  }),
}

test('StartGenie helpers pin the verified official homepage, careers page, sitemap, and listing cards', async () => {
  const startgenie = await loadStartGenieModule()

  assert.equal(startgenie.SOURCE, 'startgenie')
  assert.equal(startgenie.COMPANY, 'StartGenie')
  assert.equal(startgenie.COMPANY_DOMAIN, 'startgenie.co.in')
  assert.equal(startgenie.HOMEPAGE_URL, 'https://startgenie.co.in/')
  assert.equal(startgenie.CAREERS_URL, 'https://startgenie.co.in/careers/')
  assert.equal(startgenie.JOB_SITEMAP_URL, 'https://startgenie.co.in/awsm_job_openings-sitemap.xml')
  assert.equal(startgenie.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(startgenie.hasOfficialCareersSignal(CAREERS_HTML), true)

  const listingCards = startgenie.extractJobCards(CAREERS_HTML)
  assert.equal(listingCards.length, 5)
  assert.equal(listingCards[0].isExpired, true)
  assert.equal(listingCards[1].jobId, '2771')
  assert.equal(listingCards[1].title, 'Video Production Internship')
  assert.deepEqual(listingCards[1].locations, ['Bangalore', 'Hybrid'])

  assert.deepEqual(startgenie.extractSitemapUrls(JOB_SITEMAP_XML), [
    'https://startgenie.co.in/jobs/digital-marketing-internship-startgenie-x-trigunita-ed-techclient-acquisition-internship-performance-based/',
    'https://startgenie.co.in/jobs/video-production-internship/',
    'https://startgenie.co.in/jobs/graphic-designer-canva-specialist-visual-video-content/',
    'https://startgenie.co.in/jobs/client-acquisition-internship-performance-based/',
  ])
})

test('StartGenie scraper returns only active first-party public jobs and enriches them from detail pages', async () => {
  const startgenie = await loadStartGenieModule()
  const requestedUrls = []

  const jobs = await startgenie.createStartGenieScraper({
    now: () => '2026-07-13T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === startgenie.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === startgenie.CAREERS_URL) return CAREERS_HTML
      if (url === startgenie.JOB_SITEMAP_URL) return JOB_SITEMAP_XML
      if (JOB_DETAIL_HTML_BY_URL[url]) return JOB_DETAIL_HTML_BY_URL[url]

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    startgenie.HOMEPAGE_URL,
    startgenie.CAREERS_URL,
    startgenie.JOB_SITEMAP_URL,
    'https://startgenie.co.in/jobs/video-production-internship/',
    'https://startgenie.co.in/jobs/digital-marketing-internship-startgenie-x-trigunita-ed-techclient-acquisition-internship-performance-based/',
    'https://startgenie.co.in/jobs/client-acquisition-internship-performance-based/',
    'https://startgenie.co.in/jobs/graphic-designer-canva-specialist-visual-video-content/',
  ])

  assert.equal(jobs.length, 4)
  assert.deepEqual(jobs.map((job) => job.jobId), ['2771', '2770', '2769', '2756'])

  assert.deepEqual(jobs[0], {
    jobId: '2771',
    requisitionId: '2771',
    title: 'Video Production Internship',
    company: 'StartGenie',
    department: 'Videography',
    location: 'Bangalore, Hybrid, India',
    locations: ['Bangalore', 'Hybrid'],
    city: 'Bangalore',
    country: 'India',
    link: 'https://startgenie.co.in/jobs/video-production-internship/',
    applyUrl: 'https://startgenie.co.in/jobs/video-production-internship/',
    sourceUrl: 'https://startgenie.co.in/jobs/video-production-internship/',
    source: 'startgenie',
    companyCareerPage: 'https://startgenie.co.in/careers/',
    companyDomain: 'startgenie.co.in',
    atsPlatform: 'official-company-careers',
    employmentType: 'Internship',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2025-05-20T07:00:12+05:30',
    closingDate: null,
    jobDescription: "About Us: StartGenie is looking for enthusiastic Videography & Editing interns. Key Responsibilities: - Handle videography for campaigns. - Edit social media assets. Skills Required: Video editing tools and creative storytelling. Let's create something amazing together! Apply now!",
    remoteStatus: 'Hybrid',
    scrapedAt: '2026-07-13T00:00:00.000Z',
  })

  assert.equal(jobs[1].city, 'Remote')
  assert.equal(jobs[1].location, 'Remote, India')
  assert.equal(jobs[1].remoteStatus, 'Remote')
  assert.equal(jobs[2].city, 'Remote')
  assert.equal(jobs[2].location, 'Hybrid / Remote, India')
  assert.equal(jobs[2].remoteStatus, 'Hybrid')
  assert.equal(jobs[3].employmentType, 'Full Time')
})

test('StartGenie scraper fails closed when a listed first-party detail page no longer exposes the verified public apply surface', async () => {
  const startgenie = await loadStartGenieModule()

  await assert.rejects(
    startgenie.createStartGenieScraper().run({
      fetchText: async (url) => {
        if (url === startgenie.HOMEPAGE_URL) return HOMEPAGE_HTML
        if (url === startgenie.CAREERS_URL) return CAREERS_HTML
        if (url === startgenie.JOB_SITEMAP_URL) return JOB_SITEMAP_XML

        if (url === 'https://startgenie.co.in/jobs/video-production-internship/') {
          return `
            <html>
              <head><title>Video Production Internship - StartGenie</title></head>
              <body>
                <h1 class="entry-title awsm-jobs-single-title">Video Production Internship</h1>
                <div class="awsm-job-specification-wrapper">
                  <div class="awsm-job-specification-item awsm-job-specification-job-type">
                    <span class="awsm-job-specification-term">Internship</span>
                  </div>
                </div>
              </body>
            </html>
          `
        }

        if (JOB_DETAIL_HTML_BY_URL[url]) return JOB_DETAIL_HTML_BY_URL[url]

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /StartGenie detail page no longer matches the verified public job surface/i,
  )
})
