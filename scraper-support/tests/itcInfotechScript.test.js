import assert from 'node:assert/strict'
import test from 'node:test'

const loadItcInfotechModule = async () => {
  try {
    return await import('../../scraper/itcinfotech/script.js')
  } catch {
    assert.fail('Expected ITC Infotech scraper module at ../../scraper/itcinfotech/script.js')
  }
}

test('createItcInfotechScraper keeps India listings on the public Zwayam flow and decorates final jobs', async () => {
  const itcInfotech = await loadItcInfotechModule()
  const {
    OFFICIAL_CAREERS_URL,
    LISTING_API_URL,
    DETAIL_API_URL,
    transformItcInfotechJob,
    createItcInfotechScraper,
    run,
  } = itcInfotech

  assert.equal(OFFICIAL_CAREERS_URL, 'https://jobs.itcinfotech.com/itcinfotech/jobslist')
  assert.equal(LISTING_API_URL, 'https://public.zwayam.com/jobs/search')
  assert.equal(DETAIL_API_URL, 'https://public.zwayam.com/jobs-service/v1/jobs/careersite')
  assert.equal(typeof transformItcInfotechJob, 'function')
  assert.equal(typeof createItcInfotechScraper, 'function')
  assert.equal(typeof run, 'function')

  const indiaListing = {
    id: 98123, companyId: 15154, status: 1, careerSiteUrl: 'jobs.itcinfotech.com',
    jobLocationRecord: [{ country: 'India', city: 'Bengaluru' }],
    jobTitle: 'Senior Data Engineer',
    jobUrl: 'senior-data-engineer',
    jobCode: '98123',
    referenceNumber: 'REQ-98123',
    departmentName: 'Data Platform Engineering',
    location: 'Bengaluru, Karnataka, India',
    locAgg: 'Bengaluru, Karnataka, India',
    experienceUIField: '5-8 years',
    shortDescription: '<p>Build &amp; operate data platforms.</p>',
  }

  const detailPayload = {
    id: 98123, companyId: 15154, status: 1, careerSiteUrl: 'jobs.itcinfotech.com',
    jobTitle: 'Senior Data Engineer',
    jobUrl: 'senior-data-engineer',
    jobCode: '98123',
    referenceNumber: 'REQ-98123',
    location: 'Bengaluru, Karnataka, India',
    department: { departmentName: 'Data Platform Engineering' },
    createDate: '2026-07-01',
    jobConfigurationData: {
      Description: '<p>Design &amp; operate data platforms.</p>',
      'Skills Required': 'Python, Databricks',
    },
  }

  assert.deepEqual(transformItcInfotechJob(indiaListing, detailPayload), {
    title: 'Senior Data Engineer',
    company: 'ITC Infotech',
    department: 'Data Platform Engineering',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    jobId: '98123',
    requisitionId: 'REQ-98123',
    sourceUrl: 'https://jobs.itcinfotech.com/itcinfotech/jobview/senior-data-engineer?id=98123',
    applyUrl: 'https://jobs.itcinfotech.com/itcinfotech/jobview/senior-data-engineer?id=98123',
    employmentType: null,
    experienceRequired: '5-8 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Python', 'Databricks'],
    postingDate: '2026-07-01',
    closingDate: null,
    jobDescription: 'Design & operate data platforms.',
  })

  const requests = []
  const jobs = await createItcInfotechScraper({ maxPages: 1, maxJobs: 5 }).run({
    fetchJson: async (url, options = {}) => {
      requests.push({ url, options })

      if (url === LISTING_API_URL) {
        return {
          data: {
            data: [
              { _source: indiaListing },
              {
                _source: {
                  jobTitle: 'Senior Data Engineer, US',
                  id: 77111, companyId: 15154, status: 1,
                  jobLocationRecord: [{ country: 'United States', city: 'Dallas' }],
                  jobUrl: 'senior-data-engineer-us',
                  jobCode: '77111',
                  referenceNumber: 'REQ-77111',
                  departmentName: 'Data Platform Engineering',
                  location: 'Dallas, Texas, United States',
                  locAgg: 'Dallas, Texas, United States',
                },
              },
            ],
            facetedSearchConfig: { paginationHowMuch: 10 },
            totalCount: 2,
            hasMoreData: false,
          },
        }
      }

      if (url === DETAIL_API_URL) {
        return detailPayload
      }

      throw new Error(`Unexpected URL ${url}`)
    },
    fetchText: async () => {
      assert.fail('Expected the Zwayam detail payload to provide the ITC Infotech description')
    },
  })

  const expectedRequests = [
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
          domain: 'jobs.itcinfotech.com',
          companyId: 'MTUxNTQ=',
        },
      },
    },
    {
      url: 'https://public.zwayam.com/jobs-service/v1/jobs/careersite',
      options: {
        method: 'POST',
        json: {
          jobUrl: 'senior-data-engineer',
          externalSource: 'CareerSite',
          campusUrl: 'empty',
          companyId: '15154',
        },
      },
    },
  ]
  expectedRequests.push(expectedRequests[0])
  assert.deepEqual(requests, expectedRequests)

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '98123')
  assert.equal(jobs[0].location, 'Bengaluru, Karnataka, India')
  assert.equal(jobs[0].source, 'itcinfotech')
  assert.equal(
    jobs[0].link,
    'https://jobs.itcinfotech.com/itcinfotech/jobview/senior-data-engineer?id=98123',
  )
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
