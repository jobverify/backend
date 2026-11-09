import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  MERCEDES_BENZ_TALEO_SEARCH_URL,
  createMercedesBenzScraper,
  extractJobDescription,
  extractSearchResults,
} from '../../scraper/mercedesbenz/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'mercedesbenz',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const liveStyleSearchPayload = {
  requisitionList: [
    {
      hotJob: true,
      addedToJobCart: false,
      draft: false,
      alreadyAppliedOn: false,
      toReApply: false,
      jobId: '898368',
      contestNo: 'MER00043GZ',
      column: [
        'Senior Program Manager - Data, Business Analytics, and AI',
        '["India-Karnataka-Bangalore"]',
        'Jul 17, 2026',
      ],
      linkedColumn: 0,
      locationsColumns: [1],
    },
    {
      hotJob: false,
      addedToJobCart: false,
      draft: false,
      alreadyAppliedOn: false,
      toReApply: false,
      jobId: '905523',
      contestNo: 'MER000467B',
      column: [
        'Intern, Stock Management & Logistics',
        '["Malaysia-Selangor Darul Ehsan-Puchong"]',
        'Jul 17, 2026',
      ],
      linkedColumn: 0,
      locationsColumns: [1],
    },
  ],
  facetResults: [],
  pagingData: {
    totalCount: 2,
    pageNo: 1,
    pageSize: 25,
  },
  queryString: 'lang=en&portal=101430233',
}

const liveStyleDetailPayload = `
  <script>
    api.fillList('requisitionDescriptionInterface', 'descRequisition', [
      '898368',
      'true',
      '898368',
      'false',
      'Submission for the position: Senior Program Manager - Data, Business Analytics, and AI - (Job Number: MER00043GZ)',
      'false',
      '898368',
      'false',
      'true',
      'Senior Program Manager - Data, Business Analytics, and AI',
      'Mercedes-Benz Group AG',
      'Mercedes-Benz Group AG',
      '!*!%3Cp style=%22line-height:120%;%22%3EAbout MBRDI%3C%2Fp%3E%3Cp%3EBuild connected vehicle platforms.%3C%2Fp%3E'
    ]);
  </script>
`

test('extractSearchResults parses live Mercedes-Benz Taleo REST payload and keeps explicit India listings', () => {
  assert.deepEqual(extractSearchResults(liveStyleSearchPayload), [{
    title: 'Senior Program Manager - Data, Business Analytics, and AI',
    location: 'India-Karnataka-Bangalore',
    jobId: 'MER00043GZ',
    applyUrl: 'https://tas-daimler.taleo.net/careersection/ex/jobdetail.ftl?job=MER00043GZ&lang=en',
    postingDate: '2026-07-17',
  }])
})

test('extractJobDescription reads live Mercedes-Benz Taleo encoded descRequisition payload', () => {
  assert.equal(
    extractJobDescription(liveStyleDetailPayload),
    'About MBRDI Build connected vehicle platforms.',
  )
})

test('Mercedes-Benz Taleo scraper fetches details only for explicit India listings', async () => {
  const requestedUrls = []
  const scraper = createMercedesBenzScraper({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === MERCEDES_BENZ_TALEO_SEARCH_URL) return readFixture('search-results.html')
      if (url === 'https://tas-daimler.taleo.net/careersection/ex/jobdetail.ftl?job=MBIN-123&lang=en') {
        return readFixture('job-detail-MBIN-123.html')
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-08T00:00:00.000Z',
  })

  const jobs = await scraper.run()

  assert.deepEqual(requestedUrls, [
    MERCEDES_BENZ_TALEO_SEARCH_URL,
    'https://tas-daimler.taleo.net/careersection/ex/jobdetail.ftl?job=MBIN-123&lang=en',
  ])
  assert.deepEqual(jobs, [{
    title: 'Senior Software Engineer',
    company: 'Mercedes-Benz',
    department: null,
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'MBIN-123',
    requisitionId: 'MBIN-123',
    sourceUrl: MERCEDES_BENZ_TALEO_SEARCH_URL,
    applyUrl: 'https://tas-daimler.taleo.net/careersection/ex/jobdetail.ftl?job=MBIN-123&lang=en',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-01',
    closingDate: null,
    jobDescription: 'Build safety-critical vehicle software. Collaborate with engineering teams.',
    source: 'mercedesbenz',
    link: 'https://tas-daimler.taleo.net/careersection/ex/jobdetail.ftl?job=MBIN-123&lang=en',
    scrapedAt: '2026-07-08T00:00:00.000Z',
  }])
})

test('Mercedes-Benz Taleo scraper uses the REST search API without browser rendering', async () => {
  const requestedJson = []
  const requestedDetails = []
  const scraper = createMercedesBenzScraper({
    fetchJson: async (url, request) => {
      requestedJson.push({ url, request })
      return liveStyleSearchPayload
    },
    fetchText: async (url) => {
      requestedDetails.push(url)
      if (url === 'https://tas-daimler.taleo.net/careersection/ex/jobdetail.ftl?job=MER00043GZ&lang=en') {
        return liveStyleDetailPayload
      }
      throw new Error(`Unexpected detail URL: ${url}`)
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  const jobs = await scraper.run()

  assert.equal(requestedJson.length, 1)
  assert.equal(
    requestedJson[0].url,
    'https://tas-daimler.taleo.net/careersection/rest/jobboard/searchjobs?lang=en&portal=101430233',
  )
  assert.equal(requestedJson[0].request.method, 'POST')
  assert.deepEqual(JSON.parse(requestedJson[0].request.body).fieldData.fields, {
    LOCATION: '',
    KEYWORD: '',
  })
  assert.deepEqual(requestedDetails, [
    'https://tas-daimler.taleo.net/careersection/ex/jobdetail.ftl?job=MER00043GZ&lang=en',
  ])
  assert.deepEqual(jobs, [{
    title: 'Senior Program Manager - Data, Business Analytics, and AI',
    company: 'Mercedes-Benz',
    department: null,
    location: 'India-Karnataka-Bangalore',
    city: 'Bangalore',
    country: 'India',
    jobId: 'MER00043GZ',
    requisitionId: 'MER00043GZ',
    sourceUrl: MERCEDES_BENZ_TALEO_SEARCH_URL,
    applyUrl: 'https://tas-daimler.taleo.net/careersection/ex/jobdetail.ftl?job=MER00043GZ&lang=en',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-17',
    closingDate: null,
    jobDescription: 'About MBRDI Build connected vehicle platforms.',
    source: 'mercedesbenz',
    link: 'https://tas-daimler.taleo.net/careersection/ex/jobdetail.ftl?job=MER00043GZ&lang=en',
    scrapedAt: '2026-07-18T00:00:00.000Z',
  }])
})
