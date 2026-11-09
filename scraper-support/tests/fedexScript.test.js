import assert from 'node:assert/strict'
import test from 'node:test'

const loadFedExModule = async () => {
  try {
    return await import('../../scraper/fedex/script.js')
  } catch {
    return null
  }
}

const page1State = {
  jobSearch: {
    params: {
      filter: {
        country: ['India'],
      },
    },
    totalJob: 50,
    isLoading: false,
    jobs: [
      {
        reference: 'P25-349640-2',
        title: 'Technical Architect',
        brandName: 'Federal Express Corporation AMEA',
        locations: [
          {
            city: 'Hyderabad',
            state: 'Telangana',
            cityState: 'Hyderabad, Telangana',
            country: 'India',
            countryAbbr: 'IN',
            isRemote: false,
          },
        ],
        isRemote: false,
        employmentType: ['Full Time'],
        applyURL: 'https://fedex.paradox.ai/co/FederalExpressCorporation41/Job?job_id=P25-349640-2',
        originalURL: 'technical-architect/job/P25-349640-2',
        customFields: [
          { cfKey: 'cf_effective_date', value: '2026-06-18' },
          { cfKey: 'cf_currency_id', value: 'INR' },
          { cfKey: 'cf_frequency_id', value: 'Monthly' },
          { cfKey: 'cf_compensation_pay_range_data_minimum', value: '255132' },
          { cfKey: 'cf_compensation_pay_range_data_maximum', value: '595308' },
        ],
      },
      {
        reference: 'P25-348918-1',
        title: 'Full Stack Developer-Senior II-2',
        brandName: 'Federal Express Corporation AMEA',
        locations: [
          {
            city: 'Hyderabad',
            state: 'Telangana',
            cityState: 'Hyderabad, Telangana',
            country: 'India',
            countryAbbr: 'IN',
            isRemote: false,
          },
        ],
        isRemote: false,
        employmentType: ['Full Time'],
        applyURL: 'https://fedex.paradox.ai/co/FederalExpressCorporation41/Job?job_id=P25-348918-1',
        originalURL: 'full-stack-developer-senior-ii-2/job/P25-348918-1',
        customFields: [
          { cfKey: 'cf_effective_date', value: '2026-06-08' },
          { cfKey: 'cf_currency_id', value: 'INR' },
          { cfKey: 'cf_frequency_id', value: 'Monthly' },
        ],
      },
    ],
  },
}

const page2State = {
  jobSearch: {
    params: {
      filter: {
        country: ['India'],
      },
      page_number: 2,
    },
    totalJob: 50,
    isLoading: false,
    jobs: [
      {
        reference: 'P25-329754-1',
        title: 'Software Developer II',
        brandName: 'Federal Express Corporation AMEA',
        locations: [
          {
            city: 'Hyderabad',
            state: 'Telangana',
            cityState: 'Hyderabad, Telangana',
            country: 'India',
            countryAbbr: 'IN',
            isRemote: false,
          },
        ],
        isRemote: false,
        employmentType: ['Full Time'],
        applyURL: 'https://fedex.paradox.ai/co/FederalExpressCorporation41/Job?job_id=P25-329754-1',
        originalURL: 'software-developer-ii/job/P25-329754-1',
        customFields: [
          { cfKey: 'cf_effective_date', value: '2026-05-20' },
        ],
      },
    ],
  },
}

const buildSearchPageHtml = (state) => `
<!doctype html>
<html>
  <body>
    <script>
      window.__PRELOAD_STATE__ = ${JSON.stringify(state)};
    </script>
  </body>
</html>
`

const indiaSearchPageHtml = buildSearchPageHtml(page1State)
const indiaSearchPage2Html = buildSearchPageHtml(page2State)

test('buildSearchUrl keeps FedEx searches on the official India-filtered careers pages', async () => {
  const fedex = await loadFedExModule()
  assert.ok(fedex, 'FedEx scraper module must exist')

  assert.equal(
    fedex.buildSearchUrl(),
    'https://careers.fedex.com/jobs?filter[country][0]=India',
  )
  assert.equal(
    fedex.buildSearchUrl({ page: 2 }),
    'https://careers.fedex.com/jobs/page/2?filter[country][0]=India',
  )
})

test('extractSearchResults maps official FedEx India preload jobs into the shared scraper contract', async () => {
  const fedex = await loadFedExModule()
  assert.ok(fedex, 'FedEx scraper module must exist')

  const jobs = fedex.extractSearchResults(indiaSearchPageHtml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Technical Architect',
    company: 'FedEx',
    department: 'Federal Express Corporation AMEA',
    location: 'Hyderabad, Telangana, India',
    city: 'Hyderabad',
    country: 'India',
    jobId: 'P25-349640-2',
    requisitionId: 'P25-349640-2',
    sourceUrl: 'https://careers.fedex.com/technical-architect/job/P25-349640-2',
    applyUrl: 'https://fedex.paradox.ai/co/FederalExpressCorporation41/Job?job_id=P25-349640-2',
    employmentType: 'Full Time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-18',
    closingDate: null,
    jobDescription: null,
    remoteStatus: 'On-site',
    compensation: 'INR 255132-595308 per month',
  })
})

test('run fetches FedEx India pages, paginates, and decorates jobs for the runner', async () => {
  const fedex = await loadFedExModule()
  assert.ok(fedex, 'FedEx scraper module must exist')

  const requestedUrls = []
  const scraper = fedex.createFedExScraper({ maxPages: 2, maxJobs: 3 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === fedex.buildSearchUrl()) return indiaSearchPageHtml
      if (url === fedex.buildSearchUrl({ page: 2 })) return indiaSearchPage2Html
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    fedex.buildSearchUrl(),
    fedex.buildSearchUrl({ page: 2 }),
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'fedex')
  assert.equal(jobs[0].link, 'https://fedex.paradox.ai/co/FederalExpressCorporation41/Job?job_id=P25-349640-2')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
