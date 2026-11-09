import assert from 'node:assert/strict'
import test from 'node:test'

import {
  API_PAGE_LIMIT,
  CAREERS_URL,
  INDIA_JOBS_URL,
  JOBS_BROWSE_URL,
  buildIndiaJobsApiUrl,
  createElektrobitAutomotiveScraper,
  hasOfficialCareersSignal,
  hasOfficialIndiaJobsSignal,
  hasOfficialJobsPortalSignal,
} from './script.js'

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Elektrobit Jobs in Automotive - Start Now. Make a Difference.</title>
    </head>
    <body>
      <h1>Move the world with us!</h1>
      <h2>Careers at Elektrobit</h2>
      <a href="https://jobs.elektrobit.com">Open Elektrobit Jobs</a>
      <a href="https://www.elektrobit.com/careers/">Working at Elektrobit</a>
    </body>
  </html>
`

const jobsBrowseHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Elektrobit Automotive GmbH</title>
    </head>
    <body>
      <h1>Find Jobs</h1>
      <search-app></search-app>
      <div>See jobs by: Categories Brands Locations</div>
      <a href="/categories">Categories</a>
      <a href="/brands">Brands</a>
      <a href="/locations">Locations</a>
      <script src="https://app.jibecdn.com/prod/search/4.11.211/main-es2015.js"></script>
    </body>
  </html>
`

const indiaJobsHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Elektrobit Automotive GmbH</title>
      <link rel="canonical" href="https://jobs.elektrobit.com/jobs/locations/country/India" />
    </head>
    <body>
      <h1>Find Jobs</h1>
      <search-app></search-app>
      <div>See jobs by: Categories Brands Locations</div>
      <a href="mailto:recruiting@elektrobit.com">recruiting@elektrobit.com</a>
      <script>
        var dataLayer = dataLayer || [];
        dataLayer.push({ page_type: '/jobs/locations/country/India' });
      </script>
      <script>
        window._jibe = { cid: 'elektrobit', region: 'eu' };
      </script>
      <script src="https://app.jibecdn.com/prod/search/4.11.211/main-es2015.js"></script>
      <div>api/jobs</div>
    </body>
  </html>
`

const indiaPageOnePayload = {
  totalCount: 3,
  count: 3,
  jobs: [
    {
      data: {
        slug: '1177',
        req_id: '1177',
        title: 'Sales Manager - India & ASEAN',
        description: '<p>Lead regional customer growth across India and ASEAN.</p>',
        responsibilities: '<ul><li>Own regional account planning.</li><li>Build executive customer relationships.</li></ul>',
        qualifications: '<ul><li>Bachelor degree in engineering.</li><li>9 to 12 years of experience in enterprise sales.</li></ul>',
        categories: [{ name: 'Sales' }],
        category: [' Sales'],
        department: '',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        full_location: 'Bengaluru, India',
        short_location: 'Bengaluru, India',
        employment_type: 'FULL_TIME',
        posted_date: '2026-08-13T09:20:00+0000',
        posting_expiry_date: null,
        apply_url: 'https://careers-elektrobit.icims.com/jobs/1177/login',
      },
    },
    {
      data: {
        slug: '1184',
        req_id: '1184',
        title: 'Expert - Agentic Development & Automation',
        description: '<p>Design enterprise AI agents and workflow automation systems.</p>',
        responsibilities: '<p><strong>Key Responsibilities</strong><br>&bull; Build AI assistants.<br>&bull; Implement agent orchestration.</p>',
        qualifications: '<p><strong>Technical Skills</strong><br>&bull; LangGraph and LangChain.<br>&bull; 10+ years of software engineering experience.</p>',
        categories: [{ name: 'Development' }],
        category: [' Development'],
        department: '',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        full_location: 'Bengaluru, India',
        short_location: 'Bengaluru, India',
        employment_type: 'FULL_TIME',
        posted_date: '2026-08-11T09:00:00+0000',
        posting_expiry_date: null,
        apply_url: 'https://careers-elektrobit.icims.com/jobs/1184/login',
      },
    },
  ],
}

const indiaPageTwoPayload = {
  totalCount: 3,
  count: 3,
  jobs: [
    {
      data: {
        slug: '1170',
        req_id: '1170',
        title: 'Team Lead IT Infrastructure',
        description: '<p>Lead shared IT infrastructure across global teams.</p>',
        responsibilities: '<ul><li>Coordinate infrastructure operations.</li></ul>',
        qualifications: '<ul><li>Strong systems administration background.</li></ul>',
        categories: [{ name: 'Information Technology' }],
        category: [' Information Technology'],
        department: '',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        full_location: 'Bengaluru, India; Brasov, Romania; Timisoara, Romania',
        short_location: 'Bengaluru, India',
        employment_type: 'FULL_TIME',
        posted_date: '2026-08-09T09:00:00+0000',
        posting_expiry_date: null,
        apply_url: 'https://careers-elektrobit.icims.com/jobs/1170/login',
      },
    },
  ],
}

test('verified official Elektrobit careers, jobs browse, and India browse signals hold', () => {
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.equal(hasOfficialJobsPortalSignal(jobsBrowseHtml), true)
  assert.equal(hasOfficialIndiaJobsSignal(indiaJobsHtml), true)
})

test('scraper run follows the verified India API pagination and normalizes India jobs from the Jibe feed', async () => {
  const requestedPages = []
  const requestedApiUrls = []

  const jobs = await createElektrobitAutomotiveScraper({
    pageLimit: 2,
  }).run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === JOBS_BROWSE_URL) {
        return { status: 200, url, html: jobsBrowseHtml }
      }

      if (url === INDIA_JOBS_URL) {
        return { status: 200, url, html: indiaJobsHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedApiUrls.push(url)

      if (url === buildIndiaJobsApiUrl({ page: 1, limit: 2 })) return indiaPageOnePayload
      if (url === buildIndiaJobsApiUrl({ page: 2, limit: 2 })) return indiaPageTwoPayload

      throw new Error(`Unexpected API URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [
    CAREERS_URL,
    JOBS_BROWSE_URL,
    INDIA_JOBS_URL,
  ])
  assert.deepEqual(requestedApiUrls, [
    buildIndiaJobsApiUrl({ page: 1, limit: 2 }),
    buildIndiaJobsApiUrl({ page: 2, limit: 2 }),
  ])
  assert.equal(API_PAGE_LIMIT > 0, true)
  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs.map((job) => job.title), [
    'Sales Manager - India & ASEAN',
    'Expert - Agentic Development & Automation',
    'Team Lead IT Infrastructure',
  ])
  assert.deepEqual(jobs[0], {
    title: 'Sales Manager - India & ASEAN',
    company: 'Elektrobit Automotive',
    department: 'Sales',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '1177',
    requisitionId: '1177',
    sourceUrl: 'https://jobs.elektrobit.com/jobs/1177',
    applyUrl: 'https://careers-elektrobit.icims.com/jobs/1177/login',
    employmentType: 'Full-time',
    experienceRequired: '9 to 12 years of experience',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-08-13',
    closingDate: null,
    jobDescription: 'Description:\nLead regional customer growth across India and ASEAN.\n\nResponsibilities:\nOwn regional account planning. Build executive customer relationships.\n\nQualifications:\nBachelor degree in engineering. 9 to 12 years of experience in enterprise sales.',
    sourceDescription: 'Description:\nLead regional customer growth across India and ASEAN.\n\nResponsibilities:\nOwn regional account planning. Build executive customer relationships.\n\nQualifications:\nBachelor degree in engineering. 9 to 12 years of experience in enterprise sales.',
    sourceNativeCriteriaEvidence: {
      projection: 'all-own-native-fields-in-declared-order-no-deduplication',
      fields: [
        { field: 'description', present: true, rawValue: indiaPageOnePayload.jobs[0].data.description, text: 'Lead regional customer growth across India and ASEAN.' },
        { field: 'responsibilities', present: true, rawValue: indiaPageOnePayload.jobs[0].data.responsibilities, text: 'Own regional account planning. Build executive customer relationships.' },
        { field: 'qualifications', present: true, rawValue: indiaPageOnePayload.jobs[0].data.qualifications, text: 'Bachelor degree in engineering. 9 to 12 years of experience in enterprise sales.' },
      ],
    },
    sourceNativeGeographyEvidence: {
      authority: 'own-explicit-country-name',
      country: { field: 'country', present: true, rawValue: 'India' },
      country_code: { field: 'country_code', present: false },
      city: { field: 'city', present: true, rawValue: 'Bengaluru' },
    },
    source: 'elektrobitautomotive',
    link: 'https://careers-elektrobit.icims.com/jobs/1177/login',
    scrapedAt: jobs[0].scrapedAt,
  })
})

test('fails closed when the verified Elektrobit careers or jobs shells change', async () => {
  await assert.rejects(
    createElektrobitAutomotiveScraper().run({
      fetchPage: async (url) => {
        if (url === CAREERS_URL) return { status: 200, url, html: '<html><body>Placeholder</body></html>' }
        if (url === JOBS_BROWSE_URL) return { status: 200, url, html: jobsBrowseHtml }
        if (url === INDIA_JOBS_URL) return { status: 200, url, html: indiaJobsHtml }
        return indiaPageOnePayload
      },
      fetchJson: async () => indiaPageOnePayload,
    }),
    /Elektrobit careers page no longer matches the verified official public careers surface/i,
  )

  await assert.rejects(
    createElektrobitAutomotiveScraper().run({
      fetchPage: async (url) => {
        if (url === CAREERS_URL) return { status: 200, url, html: careersHtml }
        if (url === JOBS_BROWSE_URL) return { status: 200, url, html: '<html><body>No search shell</body></html>' }
        if (url === INDIA_JOBS_URL) return { status: 200, url, html: indiaJobsHtml }
        return indiaPageOnePayload
      },
      fetchJson: async () => indiaPageOnePayload,
    }),
    /Elektrobit jobs portal no longer matches the verified official public jobs surface/i,
  )

  await assert.rejects(
    createElektrobitAutomotiveScraper().run({
      fetchPage: async (url) => {
        if (url === CAREERS_URL) return { status: 200, url, html: careersHtml }
        if (url === JOBS_BROWSE_URL) return { status: 200, url, html: jobsBrowseHtml }
        if (url === INDIA_JOBS_URL) return { status: 200, url, html: '<html><body>Missing India canonical</body></html>' }
        return indiaPageOnePayload
      },
      fetchJson: async () => indiaPageOnePayload,
    }),
    /Elektrobit India jobs location page no longer matches the verified official public jobs surface/i,
  )
})

test('fails closed when the verified India API stops honoring the India country filter', async () => {
  await assert.rejects(
    createElektrobitAutomotiveScraper().run({
      fetchPage: async (url) => {
        if (url === CAREERS_URL) return { status: 200, url, html: careersHtml }
        if (url === JOBS_BROWSE_URL) return { status: 200, url, html: jobsBrowseHtml }
        if (url === INDIA_JOBS_URL) return { status: 200, url, html: indiaJobsHtml }
        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => ({
        totalCount: 1,
        count: 1,
        jobs: [
          {
            data: {
              slug: '9999',
              req_id: '9999',
              title: 'Germany-only role',
              description: '<p>Only in Germany.</p>',
              responsibilities: '<ul><li>Relocate to Erlangen.</li></ul>',
              qualifications: '<ul><li>Automotive software background.</li></ul>',
              categories: [{ name: 'Development' }],
              city: 'Erlangen',
              state: 'Bavaria',
              country: 'Germany',
              full_location: 'Erlangen, Germany',
              employment_type: 'FULL_TIME',
              posted_date: '2026-08-14T09:00:00+0000',
              apply_url: 'https://careers-elektrobit.icims.com/jobs/9999/login',
            },
          },
        ],
      }),
    }),
    /Elektrobit India jobs API no longer honors the verified India country filter/i,
  )
})


test('current India surface remains authoritative without the optional recruiting contact', () => {
  const noContactHtml = indiaJobsHtml.replace(/\s*<a href="mailto:recruiting@elektrobit\.com">[^<]+<\/a>/, '')
  assert.notEqual(noContactHtml, indiaJobsHtml)
  assert.equal(/mailto:recruiting@elektrobit\.com/.test(noContactHtml), false)
  assert.equal(hasOfficialIndiaJobsSignal(noContactHtml), true)
})

test('India surface without optional recruiting contact still reaches the existing public feed', async () => {
  const noContactHtml = indiaJobsHtml.replace(/\s*<a href="mailto:recruiting@elektrobit\.com">[^<]+<\/a>/, '')
  const requested = []
  const payload = { totalCount: 3, count: 3, jobs: [...indiaPageOnePayload.jobs, ...indiaPageTwoPayload.jobs] }
  const jobs = await createElektrobitAutomotiveScraper().run({
    fetchPage: async (url) => {
      requested.push(url)
      const html = url === CAREERS_URL ? careersHtml : url === JOBS_BROWSE_URL ? jobsBrowseHtml : url === INDIA_JOBS_URL ? noContactHtml : null
      assert.notEqual(html, null)
      return {status: 200, url, html}
    },
    fetchJson: async (url) => {
      assert.equal(url, buildIndiaJobsApiUrl())
      requested.push(url)
      return payload
    },
  })
  assert.deepEqual(requested, [CAREERS_URL, JOBS_BROWSE_URL, INDIA_JOBS_URL, buildIndiaJobsApiUrl()])
  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs.map(job => job.jobId), ['1177', '1184', '1170'])
})

test('removing optional contact keeps each existing portal and India authority condition mandatory', () => {
  const noContactHtml = indiaJobsHtml.replace(/\s*<a href="mailto:recruiting@elektrobit\.com">[^<]+<\/a>/, '')
  const mutations = [
    html => html.replace('Elektrobit Automotive GmbH', 'Unrelated employer'),
    html => html.replace('Find Jobs', 'Unrelated heading'),
    html => html.replace('See jobs by: Categories Brands Locations', 'Other navigation'),
    html => html.replace('<search-app>', '<unrelated-app>'),
    html => html.replace('app.jibecdn.com/prod/search/', 'unrelated.invalid/client/'),
    html => html.replace('canonical" href="https://jobs.elektrobit.com/jobs/locations/country/India', 'canonical" href="https://jobs.elektrobit.com/jobs/locations/country/Germany'),
    html => html.replace("page_type: '/jobs/locations/country/India'", "page_type: '/jobs/locations/country/Germany'"),
  ]
  for (const mutate of mutations) {
    const changed = mutate(noContactHtml)
    assert.notEqual(changed, noContactHtml)
    assert.equal(hasOfficialIndiaJobsSignal(changed), false)
  }
})
