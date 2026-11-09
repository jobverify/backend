import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  HOMEPAGE_URL,
  MISSING_ROUTE_URLS,
  SOURCE,
  createEizenScraper,
  extractPublicJobs,
  hasOfficialCareersSignal,
  hasOfficialHomepageSignal,
  hasVerifiedCareersLink,
  isVerifiedMissingRoute,
} from './script.js'

const homepageHtml = `
  <html>
    <head>
      <title>Eizen AI</title>
      <meta property="og:url" content="https://eizen.ai" />
      <meta property="og:site_name" content="Eizen AI" />
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Eizen AI",
          "url": "https://eizen.ai"
        }
      </script>
    </head>
    <body>
      <h2>See + Do = Action Intelligence</h2>
      <h1>Action Intelligence at Scale — Powered by Agentic AI Workflows</h1>
      <a class="dropdown-item" href="careers.html">Careers</a>
      <h6>Copyright &copy; 2025 eizen - All Rights Reserved.</h6>
    </body>
  </html>
`

const careersHtml = `
  <html>
    <head>
      <title>Eizen AI</title>
    </head>
    <body>
      <h3>WELCOME TO EIZEN CAREERS!</h3>
      <h5>
        Join our dynamic and inclusive team, where creativity and curiosity
        are encouraged. We're committed to investing in your professional
        development and well-being. Explore our open positions and join us
        on our journey to shape the future of AI!
      </h5>

      <h3>Current Openings :</h3>

      <h5>
        <a href="https://optimhire.com/company/eizen/job/162016" class="purple">
          Machine Learning Engineer</a
        >
      </h5>
      <p style="color: black">Location: Bengaluru</p>

      <h5>
        <a
          href="https://www.linkedin.com/jobs/view/3572547388/?alternateChannel=search&refId=udCjB5br9OsQCvjqw0tPUQ%3D%3D&trackingId=uaMgEbkbBB0UJuN%2BEWYdEw%3D%3D"
          class="purple">
          Full Stack Engineer</a
        >
      </h5>
      <p style="color: black">Location: Hyderabad</p>

      <a
        href="mailto:madhu@eigenmaps.ai?subject=Inquiry%20about%20Generative%20AI%20Solutions"
        class="btn">
        Let's connect!
      </a>
      <a class="list-group-item group-item" href="careers.html">Careers</a>
      <h6>Copyright &copy; 2025 eizen - All Rights Reserved.</h6>
    </body>
  </html>
`

const createMissingRouteHtml = (key) => `
  <html>
    <head><title>404 Not Found</title></head>
    <body>
      <h1>404 Not Found</h1>
      <ul>
        <li>Code: NoSuchKey</li>
        <li>Message: The specified key does not exist.</li>
        <li>Key: ${key}</li>
      </ul>
      <hr />
    </body>
  </html>
`

test('eizen scraper recognizes the verified homepage, careers page, and missing-route surface', () => {
  assert.equal(SOURCE, 'eizen')
  assert.equal(COMPANY, 'eizen')
  assert.equal(HOMEPAGE_URL, 'https://eizen.ai/')
  assert.equal(CAREERS_URL, 'https://eizen.ai/careers.html')
  assert.deepEqual(MISSING_ROUTE_URLS, [
    'https://eizen.ai/career',
    'https://eizen.ai/careers',
    'https://eizen.ai/jobs',
    'https://eizen.ai/join-us',
    'https://eizen.ai/current-openings',
    'https://eizen.ai/openings',
  ])
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasVerifiedCareersLink(homepageHtml), true)
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    isVerifiedMissingRoute({
      status: 404,
      html: createMissingRouteHtml('career'),
      url: MISSING_ROUTE_URLS[0],
    }),
    true,
  )
})

test('eizen scraper extracts the verified current openings with canonical apply links', () => {
  const jobs = extractPublicJobs(careersHtml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Machine Learning Engineer',
    company: 'eizen',
    department: null,
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'eizen-162016',
    requisitionId: '162016',
    sourceUrl: 'https://eizen.ai/careers.html',
    applyUrl: 'https://optimhire.com/company/eizen/job/162016',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })

  assert.deepEqual(jobs[1], {
    title: 'Full Stack Engineer',
    company: 'eizen',
    department: null,
    location: 'Hyderabad, India',
    city: 'Hyderabad',
    country: 'India',
    jobId: 'eizen-3572547388',
    requisitionId: '3572547388',
    sourceUrl: 'https://eizen.ai/careers.html',
    applyUrl: 'https://www.linkedin.com/jobs/view/3572547388/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
})

test('eizen scraper runs end to end and fails closed on verified-surface drift', async () => {
  const requestedUrls = []

  const jobs = await createEizenScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (MISSING_ROUTE_URLS.includes(url)) {
        const key = new URL(url).pathname.replace(/^\/+/, '')
        return { status: 404, url, html: createMissingRouteHtml(key) }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CAREERS_URL, ...MISSING_ROUTE_URLS])
  assert.equal(jobs[0].source, 'eizen')
  assert.equal(jobs[0].link, 'https://optimhire.com/company/eizen/job/162016')
  assert.equal(jobs[0].companyCareerPage, 'https://eizen.ai/careers.html')
  assert.equal(jobs[0].companyDomain, 'eizen.ai')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)

  await assert.rejects(
    createEizenScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Placeholder</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    createEizenScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === CAREERS_URL) {
          return {
            status: 200,
            url,
            html: `
              <html>
                <body>
                  <h3>WELCOME TO EIZEN CAREERS!</h3>
                  <p>Current Openings :</p>
                </body>
              </html>
            `,
          }
        }

        if (MISSING_ROUTE_URLS.includes(url)) {
          const key = new URL(url).pathname.replace(/^\/+/, '')
          return { status: 404, url, html: createMissingRouteHtml(key) }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public openings changed materially|careers page/i,
  )

  await assert.rejects(
    createEizenScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === MISSING_ROUTE_URLS[0]) {
          return { status: 200, url, html: careersHtml }
        }

        if (MISSING_ROUTE_URLS.slice(1).includes(url)) {
          const key = new URL(url).pathname.replace(/^\/+/, '')
          return { status: 404, url, html: createMissingRouteHtml(key) }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /missing jobs routes changed materially/i,
  )
})
