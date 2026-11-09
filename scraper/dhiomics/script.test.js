import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-13T00:00:00.000Z'

const dhiOmicsHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>ADA Global | The Data &amp; AI Experience Company</title>
  </head>
  <body>
    <header>
      <nav>
        <a href="https://adaglobal.com/our-company/">Our Story</a>
        <a href="https://adaglobal.com/careers/">Careers</a>
      </nav>
    </header>
    <main>
      <h1>The Data &amp; AI Experience Company</h1>
      <p>ADA is the Data &amp; AI Experience Company.</p>
    </main>
  </body>
</html>
`

const adaCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Build What the Next Era Runs On | ADA Global</title>
  </head>
  <body>
    <main>
      <h1>Build what the next era runs on</h1>
      <p>Discover career opportunities at ADA Global.</p>
      <a href="https://adaglobal.darwinbox.com/ms/candidatev2/main/careers/allJobs" target="_blank" rel="noopener noreferrer">
        Search and View Jobs
      </a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected dhiOmics scraper module at ./script.js')
  }
}

test('dhiOmics scraper verifies the ADA Global handoff and Darwinbox public jobs URL', async () => {
  const {
    COMPANY_NAME,
    SOURCE,
    DARWINBOX_COMPANY_ID,
    DARWINBOX_ORIGIN,
    OFFICIAL_HOMEPAGE_URL,
    VERIFIED_REDIRECT_URL,
    OFFICIAL_CAREERS_URL,
    PUBLIC_JOBS_URL,
    hasVerifiedDhiOmicsHomepageRedirect,
    extractPublicJobsUrl,
    hasVerifiedAdaCareersSignals,
    createDhiOmicsScraper,
  } = await loadModule()

  assert.equal(COMPANY_NAME, 'dhiOmics')
  assert.equal(SOURCE, 'dhiomics')
  assert.equal(DARWINBOX_COMPANY_ID, 'main')
  assert.equal(DARWINBOX_ORIGIN, 'https://adaglobal.darwinbox.com')
  assert.equal(OFFICIAL_HOMEPAGE_URL, 'https://dhiomics.com')
  assert.equal(VERIFIED_REDIRECT_URL, 'https://adaglobal.com/')
  assert.equal(OFFICIAL_CAREERS_URL, 'https://adaglobal.com/careers/')
  assert.equal(
    PUBLIC_JOBS_URL,
    'https://adaglobal.darwinbox.com/ms/candidatev2/main/careers/allJobs',
  )

  assert.equal(
    hasVerifiedDhiOmicsHomepageRedirect({
      status: 200,
      url: VERIFIED_REDIRECT_URL,
      html: dhiOmicsHomepageHtml,
    }),
    true,
  )
  assert.equal(extractPublicJobsUrl(adaCareersHtml), PUBLIC_JOBS_URL)
  assert.equal(hasVerifiedAdaCareersSignals(adaCareersHtml), true)

  const scraper = createDhiOmicsScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  assert.equal(
    scraper.buildCareersPageUrl(),
    'https://adaglobal.darwinbox.com/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    scraper.buildListingApiUrl(),
    'https://adaglobal.darwinbox.com/ms/candidateapi/job/alljobs',
  )
  assert.equal(
    scraper.buildJobDetailUrl('ada-001'),
    'https://adaglobal.darwinbox.com/ms/candidatev2/main/careers/jobDetails/ada-001',
  )

  const requestedUrls = []
  const requestedPages = []
  const jobs = await scraper.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === OFFICIAL_HOMEPAGE_URL) {
        return {
          status: 200,
          url: VERIFIED_REDIRECT_URL,
          html: dhiOmicsHomepageHtml,
        }
      }

      if (url === OFFICIAL_CAREERS_URL) {
        return {
          status: 200,
          url: OFFICIAL_CAREERS_URL,
          html: adaCareersHtml,
        }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)

      return {
        status: 'success',
        data: [
          {
            id: 'ada-001',
            title: 'Senior Data Scientist',
            department_name: 'Data Science',
            locations: 'Bengaluru, Karnataka, India',
            country: 'India',
            emp_type_name: 'Full Time',
            experience: '4 - 7 Years',
            posted_on: 1783814400,
            job_posting: {careers:{source:'careers',from:1783814400,to:null}},
            jd: '<p>Build decisioning and AI products for regional clients. Develop robust data science workflows, collaborate with engineering teams and deliver reliable production systems.</p>',
          },
          {
            id: 'ada-my-001',
            title: 'Growth Manager',
            department_name: 'Growth',
            locations: 'Kuala Lumpur, Malaysia',
            country: 'Malaysia',
            emp_type_name: 'Full Time',
            experience: '5 - 8 Years',
            posted_on: 1783814400,
            job_posting: {careers:{source:'careers',from:1783814400,to:null}},
            jd: '<p>Lead regional growth.</p>',
          },
        ],
        job_counts: 2,
      }
    },
  })

  assert.deepEqual(requestedUrls, [OFFICIAL_HOMEPAGE_URL, OFFICIAL_CAREERS_URL])
  assert.deepEqual(requestedPages, [1])
  assert.deepEqual(jobs, [
    {
      title: 'Senior Data Scientist',
      company: 'dhiOmics',
      department: 'Data Science',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      jobId: 'ada-001',
      requisitionId: null,
      sourceUrl: 'https://adaglobal.darwinbox.com/ms/candidatev2/main/careers/jobDetails/ada-001',
      applyUrl: 'https://adaglobal.darwinbox.com/ms/candidatev2/main/careers/jobDetails/ada-001',
      employmentType: 'Full Time',
      experienceRequired: '4 - 7 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-12T00:00:00.000Z',
      sourcePostingDate: '2026-07-12T00:00:00.000Z',
      sourceDateEvidence: 'darwinbox-native-posted-on-v1',
      sourceNativePostedOn: 1783814400,
      sourceNativeCareersFrom: 1783814400,
      closingDate: null,
      jobDescription: '<p>Build decisioning and AI products for regional clients. Develop robust data science workflows, collaborate with engineering teams and deliver reliable production systems.</p>',
      source: 'dhiomics',
      country: 'India',
      sourceListingComplete: false,
      link: 'https://adaglobal.darwinbox.com/ms/candidatev2/main/careers/jobDetails/ada-001',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('dhiOmics scraper fails closed when the verified handoff or public jobs URL changes', async () => {
  const {
    OFFICIAL_HOMEPAGE_URL,
    VERIFIED_REDIRECT_URL,
    OFFICIAL_CAREERS_URL,
    createDhiOmicsScraper,
  } = await loadModule()

  const scraper = createDhiOmicsScraper()

  await assert.rejects(
    scraper.run({
      fetchPage: async (url) => {
        if (url === OFFICIAL_HOMEPAGE_URL) {
          return {
            status: 200,
            url: 'https://example.com/',
            html: dhiOmicsHomepageHtml,
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchListingPage: async () => ({ data: [], job_counts: 0 }),
    }),
    /verified official homepage redirect/i,
  )

  await assert.rejects(
    scraper.run({
      fetchPage: async (url) => {
        if (url === OFFICIAL_HOMEPAGE_URL) {
          return {
            status: 200,
            url: VERIFIED_REDIRECT_URL,
            html: dhiOmicsHomepageHtml,
          }
        }

        if (url === OFFICIAL_CAREERS_URL) {
          return {
            status: 200,
            url,
            html: adaCareersHtml.replace(
              'https://adaglobal.darwinbox.com/ms/candidatev2/main/careers/allJobs',
              'https://adaglobal.darwinbox.com/ms/candidatev2/main/careers/home',
            ),
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchListingPage: async () => ({ data: [], job_counts: 0 }),
    }),
    /verified official careers page no longer matches/i,
  )
})
