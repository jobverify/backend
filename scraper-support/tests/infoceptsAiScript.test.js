import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'infoceptsai',
)

const readJsonFixture = (name) => JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

const searchPayload = readJsonFixture('search-results.json')
const detailPayload = readJsonFixture('job-detail-14423.json')

const loadInfoceptsAiModule = async () => {
  try {
    return await import('../../scraper/infoceptsai/script.js')
  } catch {
    assert.fail('Expected Infocepts.AI scraper module at ../../scraper/infoceptsai/script.js')
  }
}

test('Infocepts.AI keeps the verified first-party careers and Zwayam contracts pinned', async () => {
  const infoceptsAi = await loadInfoceptsAiModule()
  const {
    OFFICIAL_CAREERS_URL,
    TALENT_PORTAL_URL,
    CAREERS_BASE_URL,
    LISTING_API_URL,
    DETAIL_API_URL,
    TENANT_GROUP_ID,
    buildSearchPayload,
    buildJobDetailUrl,
    buildDetailRequest,
  } = infoceptsAi

  assert.equal(OFFICIAL_CAREERS_URL, 'https://www.infocepts.ai/careers/')
  assert.equal(TALENT_PORTAL_URL, 'https://infotalent.infocepts.com/infocepts/')
  assert.equal(CAREERS_BASE_URL, 'https://infotalent.infocepts.com/infocepts')
  assert.equal(LISTING_API_URL, 'https://public.zwayam.com/jobs/search')
  assert.equal(DETAIL_API_URL, 'https://public.zwayam.com/jobs-service/v1/jobs/careersite')
  assert.equal(TENANT_GROUP_ID, 'G1')

  assert.deepEqual(buildSearchPayload(), {
    filterCri: JSON.stringify({
      paginationStartNo: 0,
      selectedCall: 'sort',
      sortCriteria: {
        name: 'modifiedDate',
        isAscending: false,
      },
      anyOfTheseWords: '',
    }),
    domain: 'infotalent.infocepts.com',
    companyId: 'MTUzNDI=',
  })

  assert.equal(
    buildJobDetailUrl('senior-executive-nagpur-2026060819452887', '14423'),
    'https://infotalent.infocepts.com/infocepts/jobview/senior-executive-nagpur-2026060819452887?id=14423',
  )

  assert.deepEqual(
    buildDetailRequest({
      jobUrl: 'senior-executive-nagpur-2026060819452887',
    }),
    {
      jobUrl: 'senior-executive-nagpur-2026060819452887',
      externalSource: 'CareerSite',
      campusUrl: 'empty',
      companyId: '15342',
    },
  )
})

test('Infocepts.AI search extraction keeps only India jobs from the verified portal contract', async () => {
  const { extractSearchResults, extractPaginationSummary } = await loadInfoceptsAiModule()
  const jobs = extractSearchResults(searchPayload)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Data Engineer- DBT Snowflake',
    company: 'Infocepts.AI',
    department: 'Employee',
    location: 'Chennai, Tamil Nadu, India',
    city: 'Chennai',
    jobId: '14423',
    requisitionId: '47098',
    sourceUrl: 'https://infotalent.infocepts.com/infocepts/jobview/senior-executive-nagpur-2026060819452887?id=14423',
    applyUrl: 'https://infotalent.infocepts.com/infocepts/jobview/senior-executive-nagpur-2026060819452887?id=14423',
    employmentType: null,
    experienceRequired: '7-9 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Snowflake - Development',
      'DBT',
    ],
    postingDate: '2026-06-08',
    closingDate: null,
    jobDescription: 'Backup TREQ for Pradnya',
    _listingRecord: searchPayload.data.data[0]._source,
  })

  assert.deepEqual(extractPaginationSummary(searchPayload), {
    hasNext: true,
    pageSize: 15,
    totalCount: 25,
  })
})

test('Infocepts.AI detail extraction keeps the first-party apply URL and cleaned description', async () => {
  const { extractJobDetail } = await loadInfoceptsAiModule()
  const detail = extractJobDetail(detailPayload, {
    title: 'Senior Data Engineer- DBT Snowflake',
    department: 'Employee',
    location: 'Chennai, Tamil Nadu, India',
    city: 'Chennai',
    jobId: '14423',
    requisitionId: '47098',
    sourceUrl: 'https://infotalent.infocepts.com/infocepts/jobview/senior-executive-nagpur-2026060819452887?id=14423',
    applyUrl: 'https://infotalent.infocepts.com/infocepts/jobview/senior-executive-nagpur-2026060819452887?id=14423',
    _listingRecord: searchPayload.data.data[0]._source,
  })

  assert.deepEqual(detail, {
    title: 'Senior Data Engineer- DBT Snowflake',
    company: 'Infocepts.AI',
    department: 'Employee',
    location: 'Chennai, Tamil Nadu, India',
    city: 'Chennai',
    jobId: '14423',
    requisitionId: '47098',
    sourceUrl: 'https://infotalent.infocepts.com/infocepts/jobview/senior-executive-nagpur-2026060819452887?id=14423',
    applyUrl: 'https://infotalent.infocepts.com/infocepts/jobview/senior-executive-nagpur-2026060819452887?id=14423',
    employmentType: null,
    experienceRequired: '7 to 9 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Snowflake - Development',
      'DBT',
    ],
    postingDate: '2026-06-08',
    closingDate: null,
    jobDescription: 'Position: Senior Data Engineer-DBT Snowflake Purpose of the Position: Build and optimise cloud-based data platforms for analytics initiatives.',
  })
})

test('createInfoceptsAiScraper follows the verified first-party Zwayam request flow and decorates jobs', async () => {
  const {
    LISTING_API_URL,
    DETAIL_API_URL,
    createInfoceptsAiScraper,
  } = await loadInfoceptsAiModule()

  const requests = []
  const jobs = await createInfoceptsAiScraper({ maxPages: 1, maxJobs: 5 }).run({
    fetchJson: async (url, options = {}) => {
      requests.push({ url, options })

      if (url === LISTING_API_URL) return searchPayload
      if (url === DETAIL_API_URL) return detailPayload

      throw new Error(`Unexpected URL ${url}`)
    },
  })

  assert.deepEqual(requests, [
    {
      url: 'https://public.zwayam.com/jobs/search',
      options: {
        method: 'POST',
        form: {
          filterCri: JSON.stringify({
            paginationStartNo: 0,
            selectedCall: 'sort',
            sortCriteria: {
              name: 'modifiedDate',
              isAscending: false,
            },
            anyOfTheseWords: '',
          }),
          domain: 'infotalent.infocepts.com',
          companyId: 'MTUzNDI=',
        },
      },
    },
    {
      url: 'https://public.zwayam.com/jobs-service/v1/jobs/careersite',
      options: {
        method: 'POST',
        json: {
          jobUrl: 'senior-executive-nagpur-2026060819452887',
          externalSource: 'CareerSite',
          campusUrl: 'empty',
          companyId: '15342',
        },
      },
    },
  ])

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '14423')
  assert.equal(jobs[0].source, 'infoceptsai')
  assert.equal(jobs[0].company, 'Infocepts.AI')
  assert.equal(
    jobs[0].link,
    'https://infotalent.infocepts.com/infocepts/jobview/senior-executive-nagpur-2026060819452887?id=14423',
  )
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
