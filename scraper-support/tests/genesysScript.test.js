import assert from 'node:assert/strict'
import test from 'node:test'

const loadGenesysModule = () => import('../../scraper/genesys.workday/script.js')

test('uses Genesys official careers and public Workday jobs API endpoints', async () => {
  const {
    BASE_URL,
    CAREER_PAGE_URL,
    INDIA_COUNTRY_FACET_ID,
    JOBS_API_URL,
    buildJobsApiRequest,
  } = await loadGenesysModule()

  assert.equal(CAREER_PAGE_URL, 'https://www.genesys.com/company/careers')
  assert.equal(BASE_URL, 'https://genesys.wd1.myworkdayjobs.com/Genesys')
  assert.equal(
    JOBS_API_URL,
    'https://genesys.wd1.myworkdayjobs.com/wday/cxs/genesys/Genesys/jobs',
  )
  assert.equal(INDIA_COUNTRY_FACET_ID, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.deepEqual(buildJobsApiRequest(20, 2), {
    appliedFacets: {
      locationCountry: ['c4f78be1a8f14da0ab49ce1162348a5e'],
    },
    limit: 2,
    offset: 20,
    searchText: '',
  })
})

test('run posts the India country facet to Genesys Workday and normalizes jobs', async () => {
  const { JOBS_API_URL, createGenesysScraper } = await loadGenesysModule()
  const requests = []
  const scraper = createGenesysScraper({ pageSize: 2 })

  const jobs = await scraper.run({
    fetchJson: async (url, options) => {
      requests.push({
        url,
        method: options.method,
        body: JSON.parse(options.body),
      })

      if (requests.length === 1) {
        return {
          total: 3,
          jobPostings: [
            {
              title: 'Talent Administrator (Recruitment)',
              externalPath: '/job/Chennai-Flexible/Talent-Acquisition-Administrator---APAC_JR111330-2',
              locationsText: 'Chennai (Flexible)',
              postedOn: 'Posted Today',
              bulletFields: ['JR111330'],
            },
            {
              title: 'Senior Account Executive - BFSI, (Mumbai)',
              externalPath: '/job/Virtual-Office-Telangana/Sr-Account-Executive---BFSI_JR110928',
              locationsText: 'Virtual Office (Telangana)',
              postedOn: 'Posted Yesterday',
              bulletFields: ['JR110928'],
            },
          ],
        }
      }

      return {
        total: 3,
        jobPostings: [
          {
            title: 'Sr. Partner Sales Manager',
            externalPath: '/job/Telangana-India/Sr-Partner-Sales-Manager_JR111122',
            locationsText: '3 Locations',
            postedOn: 'Posted Yesterday',
            bulletFields: ['JR111122'],
          },
        ],
      }
    },
  })

  assert.deepEqual(requests, [
    {
      url: JOBS_API_URL,
      method: 'POST',
      body: {
        appliedFacets: {
          locationCountry: ['c4f78be1a8f14da0ab49ce1162348a5e'],
        },
        limit: 2,
        offset: 0,
        searchText: '',
      },
    },
    {
      url: JOBS_API_URL,
      method: 'POST',
      body: {
        appliedFacets: {
          locationCountry: ['c4f78be1a8f14da0ab49ce1162348a5e'],
        },
        limit: 2,
        offset: 2,
        searchText: '',
      },
    },
  ])

  assert.equal(jobs.length, 3)

  const [
    { scrapedAt, ...firstJob },
    { scrapedAt: secondScrapedAt, ...secondJob },
    { scrapedAt: thirdScrapedAt, ...thirdJob },
  ] = jobs

  assert.deepEqual(firstJob, {
    title: 'Talent Administrator (Recruitment)',
    company: 'Genesys',
    department: null,
    location: 'Chennai (Flexible)',
    city: 'Chennai',
    country: 'India',
    jobId: 'JR111330',
    requisitionId: 'JR111330',
    sourceUrl:
      'https://genesys.wd1.myworkdayjobs.com/Genesys/job/Chennai-Flexible/Talent-Acquisition-Administrator---APAC_JR111330-2',
    applyUrl:
      'https://genesys.wd1.myworkdayjobs.com/Genesys/job/Chennai-Flexible/Talent-Acquisition-Administrator---APAC_JR111330-2/apply',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: null,
    source: 'genesys',
    link:
      'https://genesys.wd1.myworkdayjobs.com/Genesys/job/Chennai-Flexible/Talent-Acquisition-Administrator---APAC_JR111330-2/apply',
  })

  assert.deepEqual(secondJob, {
    title: 'Senior Account Executive - BFSI, (Mumbai)',
    company: 'Genesys',
    department: null,
    location: 'Virtual Office (Telangana)',
    city: null,
    country: 'India',
    jobId: 'JR110928',
    requisitionId: 'JR110928',
    sourceUrl:
      'https://genesys.wd1.myworkdayjobs.com/Genesys/job/Virtual-Office-Telangana/Sr-Account-Executive---BFSI_JR110928',
    applyUrl:
      'https://genesys.wd1.myworkdayjobs.com/Genesys/job/Virtual-Office-Telangana/Sr-Account-Executive---BFSI_JR110928/apply',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: 'Remote',
    source: 'genesys',
    link:
      'https://genesys.wd1.myworkdayjobs.com/Genesys/job/Virtual-Office-Telangana/Sr-Account-Executive---BFSI_JR110928/apply',
  })

  assert.deepEqual(thirdJob, {
    title: 'Sr. Partner Sales Manager',
    company: 'Genesys',
    department: null,
    location: '3 Locations',
    city: null,
    country: 'India',
    jobId: 'JR111122',
    requisitionId: 'JR111122',
    sourceUrl:
      'https://genesys.wd1.myworkdayjobs.com/Genesys/job/Telangana-India/Sr-Partner-Sales-Manager_JR111122',
    applyUrl:
      'https://genesys.wd1.myworkdayjobs.com/Genesys/job/Telangana-India/Sr-Partner-Sales-Manager_JR111122/apply',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: null,
    source: 'genesys',
    link:
      'https://genesys.wd1.myworkdayjobs.com/Genesys/job/Telangana-India/Sr-Partner-Sales-Manager_JR111122/apply',
  })

  assert.match(scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.match(secondScrapedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.match(thirdScrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
