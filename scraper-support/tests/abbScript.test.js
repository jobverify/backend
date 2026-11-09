import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-15T00:00:00.000Z'

const loadAbbModule = async () => {
  try {
    return await import('../../scraper/abb.workday/script.js')
  } catch {
    assert.fail('Expected ABB scraper module at ../../scraper/abb.workday/script.js')
  }
}

const buildSearchResultsHtml = ({
  totalHits,
  hits,
  jobs,
  countryCounts,
}) => `
<!doctype html>
<html>
  <body>
    <script>
      phApp.ddo = ${JSON.stringify({
        eagerLoadRefineSearch: {
          totalHits,
          hits,
          data: {
            jobs,
            aggregations: [
              {
                field: 'country',
                value: countryCounts,
              },
            ],
          },
        },
      })}
    </script>
  </body>
</html>
`

const buildDetailHtml = ({
  title,
  requisitionId,
  applyUrl,
  city,
  state,
  country = 'India',
  description,
}) => `
<!doctype html>
<html>
  <head>
    <script>
      phApp.ddo = ${JSON.stringify({
        jobDetail: {
          data: {
            job: {
              title,
              reqId: requisitionId,
              jobId: requisitionId,
              applyUrl,
              ml_country: country,
              category: 'Engineering',
              postedDate: '2026-08-14T00:00:00.000+0000',
              experience: '3+ years of experience',
              job_type_fields: {
                job_type: 'Full Time',
              },
            },
          },
        },
      })}
    </script>
    <script type="application/ld+json">
      ${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        title,
        description,
        datePosted: '2026-08-14T00:00:00.000+0000',
        employmentType: 'Full Time',
        jobLocation: {
          address: {
            addressLocality: city,
            addressRegion: state,
            addressCountry: country,
          },
        },
      })}
    </script>
  </head>
  <body></body>
</html>
`

test('ABB exports the verified first-party Phenom search surface', async () => {
  const abb = await loadAbbModule()

  assert.equal(abb.SOURCE, 'abb')
  assert.equal(abb.COMPANY, 'ABB')
  assert.equal(abb.BASE_URL, 'https://careers.abb')
  assert.equal(abb.SEARCH_PATH, '/global/en/search-results')
  assert.equal(abb.buildSearchResultsPageUrl(0), 'https://careers.abb/global/en/search-results')
  assert.equal(abb.buildSearchResultsPageUrl(10), 'https://careers.abb/global/en/search-results?from=10')
})

test('ABB run reads India jobs from the official ABB Phenom search pages while preserving Workday apply links', async () => {
  const abb = await loadAbbModule()

  const pageOneJobs = [
    {
      reqId: 'JR00035306',
      jobId: 'JR00035306',
      title: 'Technical Specialist - Power System Study',
      cityStateCountry: 'Bangalore, Karnataka, India',
      city: 'Bangalore',
      country: 'India',
      category: 'Engineering',
      type: 'Full Time',
      postedDate: '2026-08-14T00:00:00.000+0000',
      applyUrl: 'https://abb.wd3.myworkdayjobs.com/External_Career_Page/job/Bangalore-Karnataka-India/Technical-Specialist---Power-System-Study_JR00035306/apply',
      ml_skills: ['power system studies'],
    },
    {
      reqId: 'JR00000001',
      jobId: 'JR00000001',
      title: 'Solutions Architect',
      cityStateCountry: 'Houston, Texas, United States',
      city: 'Houston',
      country: 'United States',
      category: 'Engineering',
      type: 'Full Time',
      postedDate: '2026-08-12T00:00:00.000+0000',
      applyUrl: 'https://abb.wd3.myworkdayjobs.com/External_Career_Page/job/Houston-Texas-United-States/Solutions-Architect_JR00000001/apply',
      ml_skills: ['solution architecture'],
    },
  ]
  const pageTwoJobs = [
    {
      reqId: 'JR00024527',
      jobId: 'JR00024527',
      title: 'Project Engineer',
      cityStateCountry: 'Chennai, Tamil Nadu, India',
      city: 'Chennai',
      country: 'India',
      category: 'Engineering',
      type: 'Full Time',
      postedDate: '2026-08-10T00:00:00.000+0000',
      applyUrl: 'https://abb.wd3.myworkdayjobs.com/External_Career_Page/job/Chennai-Tamil-Nadu-India/Project-Engineer_JR00024527/apply',
      ml_skills: ['project engineering'],
    },
    {
      reqId: 'JR00000002',
      jobId: 'JR00000002',
      title: 'Finance Specialist',
      cityStateCountry: 'Paris, Ile-de-France, France',
      city: 'Paris',
      country: 'France',
      category: 'Finance',
      type: 'Full Time',
      postedDate: '2026-08-09T00:00:00.000+0000',
      applyUrl: 'https://abb.wd3.myworkdayjobs.com/External_Career_Page/job/Paris-France/Finance-Specialist_JR00000002/apply',
      ml_skills: ['finance'],
    },
  ]

  const pageOneHtml = buildSearchResultsHtml({
    totalHits: 4,
    hits: 2,
    jobs: pageOneJobs,
    countryCounts: {
      India: 2,
      'United States': 1,
      France: 1,
    },
  })
  const pageTwoHtml = buildSearchResultsHtml({
    totalHits: 4,
    hits: 2,
    jobs: pageTwoJobs,
    countryCounts: {
      India: 2,
      'United States': 1,
      France: 1,
    },
  })

  const detailHtmlByUrl = new Map([
    [
      abb.buildJobDetailUrl(pageOneJobs[0]),
      buildDetailHtml({
        title: pageOneJobs[0].title,
        requisitionId: pageOneJobs[0].reqId,
        applyUrl: pageOneJobs[0].applyUrl,
        city: 'Bangalore',
        state: 'Karnataka',
        description: 'Design and conduct power system studies for marine and port projects.',
      }),
    ],
    [
      abb.buildJobDetailUrl(pageTwoJobs[0]),
      buildDetailHtml({
        title: pageTwoJobs[0].title,
        requisitionId: pageTwoJobs[0].reqId,
        applyUrl: pageTwoJobs[0].applyUrl,
        city: 'Chennai',
        state: 'Tamil Nadu',
        description: 'Deliver project engineering for industrial automation systems.',
      }),
    ],
  ])

  const requestedUrls = []
  const jobs = await abb.run({
    maxPages: 2,
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === abb.buildSearchResultsPageUrl(0)) return pageOneHtml
      if (url === abb.buildSearchResultsPageUrl(2)) return pageTwoHtml
      if (detailHtmlByUrl.has(url)) return detailHtmlByUrl.get(url)

      throw new Error(`Unexpected ABB fixture URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedUrls, [
    abb.buildSearchResultsPageUrl(0),
    abb.buildSearchResultsPageUrl(2),
    abb.buildJobDetailUrl(pageOneJobs[0]),
    abb.buildJobDetailUrl(pageTwoJobs[0]),
  ])
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      country: job.country,
      jobId: job.jobId,
      requisitionId: job.requisitionId,
      employmentType: job.employmentType,
      applyUrl: job.applyUrl,
      sourceUrl: job.sourceUrl,
      source: job.source,
      company: job.company,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Technical Specialist - Power System Study',
        location: 'Bangalore, Karnataka, India',
        city: 'Bangalore',
        country: 'India',
        jobId: 'JR00035306',
        requisitionId: 'JR00035306',
        employmentType: 'Full-time',
        applyUrl: pageOneJobs[0].applyUrl,
        sourceUrl: abb.buildJobDetailUrl(pageOneJobs[0]),
        source: 'abb',
        company: 'ABB',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Project Engineer',
        location: 'Chennai, Tamil Nadu, India',
        city: 'Chennai',
        country: 'India',
        jobId: 'JR00024527',
        requisitionId: 'JR00024527',
        employmentType: 'Full-time',
        applyUrl: pageTwoJobs[0].applyUrl,
        sourceUrl: abb.buildJobDetailUrl(pageTwoJobs[0]),
        source: 'abb',
        company: 'ABB',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})
