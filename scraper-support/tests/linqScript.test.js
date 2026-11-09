import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Candidates - linq, where the right job offers come to you</title>
  </head>
  <body>
    <main>
      <h1>linq</h1>
      <a href="https://app.linq.co/en/job-board">Browse jobs</a>
    </main>
  </body>
</html>
`

const companyPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>linq - Talent. Unlocked. - linq</title>
  </head>
  <body>
    <main>
      <h1>linq</h1>
      <p>Talent. Unlocked.</p>
      <p>Industry</p>
      <p>Staffing - Recruitment</p>
      <p>Company Size</p>
      <p>11-50</p>
      <p>Website</p>
      <a href="https://linq.co">linq.co</a>
      <p>Headquarters</p>
      <p>Greece, Attiki, Athens, Patsi Spyrou 62, 118 55</p>
      <p>open positions</p>
    </main>
  </body>
</html>
`

const jobBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs in Greece - linq</title>
    <meta
      name="description"
      content="Find 200+ jobs in Greece to boost your career and explore new opportunities every day."
    />
  </head>
  <body>
    <main>
      <h1>Jobs in Greece</h1>
      <p>14 results in Greece</p>
    </main>
    <script src="/_next/static/chunks/app/%5Blocale%5D/job-board/%5B%5B...filters%5D%5D/page-9ca804e5aab242b9.js"></script>
  </body>
</html>
`

const SEARCH_RESULTS_PAYLOAD = {
  data: [
    {
      id: 12493,
      headline: 'Operations & Administration Coordinator',
      updatedDateObject: {
        iso8601: '2026-07-16T08:00:00+03:00',
      },
      statusType: {
        name_en: 'Full Time',
      },
      experienceLevel: {
        name_en: 'Associate',
      },
      location: {
        title: 'Greece, Attiki, Athens',
      },
      company: {
        company_id: 1,
        name: 'linq',
      },
    },
    {
      id: 12471,
      headline: 'Tech Recruiter (On behalf of our client)',
      updatedDateObject: {
        iso8601: '2026-07-15T08:00:01+03:00',
      },
      statusType: {
        name_en: 'Full Time',
      },
      experienceLevel: {
        name_en: 'Associate',
      },
      location: {
        title: 'Greece, Attiki, Athens',
      },
      company: {
        company_id: 1,
        name: 'linq',
      },
    },
    {
      id: 12537,
      headline: 'Platform Success Specialist',
      updatedDateObject: {
        iso8601: '2026-07-07T09:49:46+03:00',
      },
      statusType: {
        name_en: 'Full Time',
      },
      experienceLevel: {
        name_en: 'Associate',
      },
      location: {
        title: 'Greece, Attiki, Avlonas',
      },
      company: {
        company_id: 1,
        name: 'linq',
      },
    },
    {
      id: 3928,
      headline: 'Business Development Executive',
      updatedDateObject: {
        iso8601: '2026-06-17T10:48:38+03:00',
      },
      statusType: {
        name_en: 'Full Time',
      },
      experienceLevel: {
        name_en: 'Mid-Level',
      },
      location: {
        title: 'Greece, Attiki, Athens',
      },
      company: {
        company_id: 1,
        name: 'linq',
      },
    },
  ],
  meta: {
    current_page: 1,
    last_page: 1,
    total: 4,
  },
}

const DETAIL_PAYLOADS = {
  12493: {
    data: {
      id: 12493,
      headline: 'Operations & Administration Coordinator',
      jobStatus: 'active',
      basicInformation:
        '<p>On behalf of our client, we are looking for a highly organized Operations &amp; Administration Coordinator.</p>',
      responsibilities: '<ul><li>Support smooth day-to-day operations.</li></ul>',
      requirements: '<ul><li>Strong coordination skills.</li></ul>',
      benefits: '<ul><li>Private health insurance.</li></ul>',
      externalApplicationLink: '',
      company: {
        company_id: 1,
        name: 'linq',
      },
      location: {
        title: 'Greece, Attiki, Athens',
      },
      statusType: {
        name_en: 'Full Time',
      },
      experienceLevel: {
        name_en: 'Associate',
      },
      updatedDateObject: {
        iso8601: '2026-07-16T08:00:00+03:00',
      },
    },
  },
  12471: {
    data: {
      id: 12471,
      headline: 'Tech Recruiter (On behalf of our client)',
      jobStatus: 'active',
      basicInformation:
        '<p>On behalf of our client, an established IT services and consulting company based in Athens, we are looking for a Tech Recruiter.</p>',
      responsibilities: '<ul><li>Manage the full recruitment cycle.</li></ul>',
      requirements: '<ul><li>3+ years of experience in recruitment.</li></ul>',
      benefits: '<ul><li>Bonus plan.</li></ul>',
      externalApplicationLink: '',
      company: {
        company_id: 1,
        name: 'linq',
      },
      location: {
        title: 'Greece, Attiki, Athens',
      },
      statusType: {
        name_en: 'Full Time',
      },
      experienceLevel: {
        name_en: 'Associate',
      },
      updatedDateObject: {
        iso8601: '2026-07-15T08:00:01+03:00',
      },
    },
  },
  12537: {
    data: {
      id: 12537,
      headline: 'Platform Success Specialist',
      jobStatus: 'active',
      basicInformation:
        '<p>Join linq as a Platform Success Specialist and help candidates and employers get the most from the product.</p>',
      responsibilities:
        '<ul><li>Own customer onboarding.</li><li>Support platform adoption.</li></ul>',
      requirements:
        '<ul><li>Experience in customer-facing operations.</li><li>Strong written communication.</li></ul>',
      benefits: '<ul><li>Flexible schedule.</li></ul>',
      externalApplicationLink: '',
      company: {
        company_id: 1,
        name: 'linq',
      },
      location: {
        title: 'Greece, Attiki, Avlonas',
      },
      statusType: {
        name_en: 'Full Time',
      },
      experienceLevel: {
        name_en: 'Associate',
      },
      updatedDateObject: {
        iso8601: '2026-07-07T09:49:46+03:00',
      },
    },
  },
  3928: {
    data: {
      id: 3928,
      headline: 'Business Development Executive',
      jobStatus: 'active',
      basicInformation:
        '<p>CollegeLink is the first and biggest recruiting platform in Greece and we are hiring a Business Development Executive.</p>',
      responsibilities:
        '<ul><li>Generate qualified pipeline.</li><li>Book meetings that convert to opportunities.</li></ul>',
      requirements:
        '<ul><li>3+ years of BDR or SDR experience.</li><li>Strong cold calling skills.</li></ul>',
      benefits: '<ul><li>Performance bonus.</li></ul>',
      externalApplicationLink: '',
      company: {
        company_id: 1,
        name: 'linq',
      },
      location: {
        title: 'Greece, Attiki, Athens',
      },
      statusType: {
        name_en: 'Full Time',
      },
      experienceLevel: {
        name_en: 'Mid-Level',
      },
      updatedDateObject: {
        iso8601: '2026-06-17T10:48:38+03:00',
      },
    },
  },
}

const loadLinqModule = async () => {
  try {
    return await import('../../scraper/linq/script.js')
  } catch {
    assert.fail('Expected Linq scraper module at ../../scraper/linq/script.js')
  }
}

test('Linq scraper constants and verified surface helpers stay pinned to the official first-party board', async () => {
  const linq = await loadLinqModule()

  assert.equal(linq.SOURCE, 'linq')
  assert.equal(linq.COMPANY, 'Linq')
  assert.equal(linq.OFFICIAL_BRAND_NAME, 'linq')
  assert.equal(linq.VERIFIED_ON, '2026-07-16')
  assert.equal(linq.HOMEPAGE_URL, 'https://linq.co/en/')
  assert.equal(linq.COMPANY_PAGE_URL, 'https://app.linq.co/en/company/1')
  assert.equal(linq.JOB_BOARD_PAGE_URL, 'https://app.linq.co/en/job-board')
  assert.equal(linq.API_BASE_URL, 'https://app.linq.co/b/api')
  assert.equal(linq.JOB_SEARCH_API_URL, 'https://app.linq.co/b/api/job-board/search')
  assert.equal(linq.JOB_DETAIL_API_BASE_URL, 'https://app.linq.co/b/api/job-board/job')
  assert.equal(linq.COMPANY_ID, 1)
  assert.equal(
    linq.buildSearchApiUrl({ companyId: linq.COMPANY_ID, page: 1, pageSize: 50 }),
    'https://app.linq.co/b/api/job-board/search?companyId=1&page=1&page_size=50',
  )
  assert.equal(linq.hasVerifiedHomepageSignal(homepageHtml), true)
  assert.equal(linq.hasVerifiedCompanyPageSignal(companyPageHtml), true)
  assert.equal(linq.hasVerifiedJobBoardSignal(jobBoardHtml), true)
  assert.equal(linq.isClientHandoffText(DETAIL_PAYLOADS[12471].data.basicInformation), true)
  assert.equal(linq.isClientHandoffText(DETAIL_PAYLOADS[12537].data.basicInformation), false)
  assert.equal(linq.isDirectLinqRole(DETAIL_PAYLOADS[12493].data), false)
  assert.equal(linq.isDirectLinqRole(DETAIL_PAYLOADS[12537].data), true)
})

test('Linq run verifies the official board, filters out client handoffs, and maps exact-company jobs', async () => {
  const linq = await loadLinqModule()
  const pageRequests = []
  const jsonRequests = []

  const jobs = await linq.createLinqScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchPage: async (url) => {
      pageRequests.push(url)

      if (url === linq.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === linq.COMPANY_PAGE_URL) return { status: 200, url, html: companyPageHtml }
      if (url === linq.JOB_BOARD_PAGE_URL) return { status: 200, url, html: jobBoardHtml }

      throw new Error(`Unexpected Linq page URL: ${url}`)
    },
    fetchJson: async (url) => {
      jsonRequests.push(url)

      if (url === 'https://app.linq.co/b/api/job-board/search?companyId=1&page=1&page_size=50') {
        return SEARCH_RESULTS_PAYLOAD
      }

      const detailMatch = url.match(/\/job\/(\d+)$/)
      if (detailMatch) {
        const detailPayload = DETAIL_PAYLOADS[Number(detailMatch[1])]
        if (detailPayload) return detailPayload
      }

      throw new Error(`Unexpected Linq API URL: ${url}`)
    },
  })

  assert.deepEqual(pageRequests, [
    linq.HOMEPAGE_URL,
    linq.COMPANY_PAGE_URL,
    linq.JOB_BOARD_PAGE_URL,
  ])
  assert.deepEqual(jsonRequests, [
    'https://app.linq.co/b/api/job-board/search?companyId=1&page=1&page_size=50',
    'https://app.linq.co/b/api/job-board/job/12493',
    'https://app.linq.co/b/api/job-board/job/12471',
    'https://app.linq.co/b/api/job-board/job/12537',
    'https://app.linq.co/b/api/job-board/job/3928',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Platform Success Specialist')
  assert.equal(jobs[0].company, 'Linq')
  assert.equal(jobs[0].source, 'linq')
  assert.equal(jobs[0].location, 'Greece, Attiki, Avlonas')
  assert.equal(jobs[0].employmentType, 'Full Time')
  assert.equal(jobs[0].experienceLevel, 'Associate')
  assert.equal(jobs[0].link, 'https://app.linq.co/en/job/12537')
  assert.equal(jobs[0].companyCareerPage, 'https://app.linq.co/en/company/1')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.match(jobs[0].description, /customer onboarding/i)
  assert.equal(jobs[1].title, 'Business Development Executive')
  assert.equal(jobs[1].link, 'https://app.linq.co/en/job/3928')
  assert.equal(jobs[1].scrapedAt, FIXED_SCRAPED_AT)
})

test('Linq scraper fails closed when the verified first-party surfaces drift', async () => {
  const linq = await loadLinqModule()

  await assert.rejects(
    linq.createLinqScraper().run({
      fetchPage: async (url) => {
        if (url === linq.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body>broken</body></html>' }
        }

        throw new Error(`Unexpected Linq page URL: ${url}`)
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    linq.createLinqScraper().run({
      fetchPage: async (url) => {
        if (url === linq.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === linq.COMPANY_PAGE_URL) return { status: 200, url, html: companyPageHtml }
        if (url === linq.JOB_BOARD_PAGE_URL) return { status: 200, url, html: jobBoardHtml }
        throw new Error(`Unexpected Linq page URL: ${url}`)
      },
      fetchJson: async (url) => {
        if (url === 'https://app.linq.co/b/api/job-board/search?companyId=1&page=1&page_size=50') {
          return {
            data: [
              {
                id: 99999,
                headline: 'Broken job',
                company: { company_id: 2, name: 'other company' },
              },
            ],
            meta: { current_page: 1, last_page: 1, total: 1 },
          }
        }

        throw new Error(`Unexpected Linq API URL: ${url}`)
      },
    }),
    /company filter|search api/i,
  )
})
