import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const VERIFIED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | GreyOrange</title>
    <meta name="description" content="GreyOrange Careers" />
    <meta
      property="og:description"
      content="Join GreyOrange - Building the world's first fully automated flexible warehouse. Explore exciting career opportunities in robotics and AI."
    />
    <base href="/greyorange/" />
  </head>
  <body>
    <main>
      <h1>GreyOrange Careers</h1>
    </main>
  </body>
</html>
`

const COMPANY_CONFIG_PAYLOAD = {
  responseStatus: 'SUCCESS',
  responseCode: 200,
  reponseObject: {
    company: {
      id: 16090,
      folder: 'greyorange',
      companyName: 'GreyOrange',
      careerSiteUrl: 'careers.greyorange.com',
      website: 'https://www.greyorange.com/',
      domainName: 'careers.greyorange.com',
    },
    configurationSeo: {
      pageTitle: 'GreyOrange - Careers',
      metDescription: 'View open positions at GreyOrange',
    },
    companyCommonConfiguration: {
      enableJobPostedDate: true,
    },
  },
}

const SEARCH_RESPONSE_PAYLOAD = {
  code: 200,
  data: {
    totalCount: 84,
    hasMoreData: true,
    facetedSearchConfig: {
      paginationHowMuch: '9',
    },
    data: [
      {
        _source: {
          jobTitle: 'Software Development Engineer in Test II',
          jobUrl: 'senior-engineer-solution-qa-gurugram-hq-2026052710320963',
          jobCode: 10339,
          referenceNumber: '10339',
          location: 'Gurugram - HQ',
          departmentName: 'GreyMatter Quality Assurance',
          shortDescription: '<p>Senior Engineer - Solution QA</p>',
          createDate: '2026-05-27T10:32:09.963Z',
        },
      },
    ],
  },
}

const DETAIL_RESPONSE_PAYLOAD = {
  jobTitle: 'Software Development Engineer in Test II',
  jobCode: 10339,
  referenceNumber: '10339',
  department: {
    departmentName: 'GreyMatter Quality Assurance',
  },
  createDate: '2026-05-27T10:32:09.963Z',
  yrsOfExperience: '3 to 6 Years ',
  skillSet: 'Python,Quality Engineer,Pytest,Performance Testing,linux,API Automation,Ci/Cd,GIT Version Control',
  jobConfigurationData: {
    Location: 'Gurugram - HQ',
    'Job Description':
      '<p>As a Senior Engineer in Solution QA at GreyOrange, you will play a vital role in ensuring the quality and reliability of our cutting-edge robotic solutions.</p>',
  },
}

const loadModule = async () => {
  try {
    return await import('../../scraper/greyorange/script.js')
  } catch {
    assert.fail('Expected GreyOrange scraper module at ../../scraper/greyorange/script.js')
  }
}

test('GreyOrange helpers stay pinned to the verified first-party careers page and public Zwayam APIs', async () => {
  const greyorange = await loadModule()

  assert.equal(greyorange.SOURCE, 'greyorange')
  assert.equal(greyorange.COMPANY, 'GreyOrange')
  assert.equal(greyorange.OFFICIAL_BRAND_NAME, 'GreyOrange')
  assert.equal(greyorange.VERIFIED_ON, '2026-07-17')
  assert.equal(greyorange.CAREERS_URL, 'https://careers.greyorange.com/greyorange/')
  assert.equal(
    greyorange.COMPANY_CONFIG_URL,
    'https://public.zwayam.com/data-service/v2/company/16090/careersite-configurations',
  )
  assert.equal(greyorange.SEARCH_API_URL, 'https://public.zwayam.com/jobs/search')
  assert.equal(
    greyorange.DETAIL_API_URL,
    'https://public.zwayam.com/jobs-service/v1/jobs/careersite',
  )
  assert.equal(greyorange.PUBLIC_JOB_BASE_URL, 'https://careers.greyorange.com/greyorange/jobview')
  assert.equal(greyorange.COMPANY_ID, 'MTYwOTA=')
  assert.equal(greyorange.DETAIL_COMPANY_ID, '16090')
  assert.equal(greyorange.SEARCH_DOMAIN, 'careers.greyorange.com')
  assert.equal(greyorange.DEFAULT_PAGE_SIZE, 9)
  assert.equal(greyorange.hasOfficialCareersSignal(VERIFIED_CAREERS_HTML), true)
  assert.equal(
    greyorange.hasOfficialCareersSignal('<html><body><h1>Careers</h1></body></html>'),
    false,
  )
  assert.equal(greyorange.hasVerifiedCompanyConfig(COMPANY_CONFIG_PAYLOAD), true)
  assert.equal(
    greyorange.hasVerifiedCompanyConfig({
      ...COMPANY_CONFIG_PAYLOAD,
      reponseObject: {
        ...COMPANY_CONFIG_PAYLOAD.reponseObject,
        company: {
          ...COMPANY_CONFIG_PAYLOAD.reponseObject.company,
          companyName: 'Other Company',
        },
      },
    }),
    false,
  )
  assert.equal(
    greyorange.buildPublicJobUrl('senior-engineer-solution-qa-gurugram-hq-2026052710320963'),
    'https://careers.greyorange.com/greyorange/jobview/senior-engineer-solution-qa-gurugram-hq-2026052710320963',
  )

  const searchPayload = greyorange.buildSearchPayload({ page: 2, keywords: 'qa' })
  assert.equal(searchPayload.domain, 'careers.greyorange.com')
  assert.equal(searchPayload.companyId, 'MTYwOTA=')
  assert.deepEqual(JSON.parse(searchPayload.filterCri), {
    selectedCall: 'sort',
    paginationStartNo: 9,
    sortCriteria: {
      name: 'modifiedDate',
      isAscending: false,
    },
    anyOfTheseWords: 'qa',
  })

  const listings = greyorange.extractSearchResults(SEARCH_RESPONSE_PAYLOAD)
  assert.equal(listings.length, 1)
  assert.deepEqual(listings[0], {
    title: 'Software Development Engineer in Test II',
    company: 'GreyOrange',
    department: 'GreyMatter Quality Assurance',
    location: 'Gurugram - HQ',
    city: 'Gurugram',
    country: null,
    jobId: '10339',
    requisitionId: '10339',
    sourceUrl: 'https://careers.greyorange.com/greyorange/jobview/senior-engineer-solution-qa-gurugram-hq-2026052710320963',
    applyUrl: 'https://careers.greyorange.com/greyorange/jobview/senior-engineer-solution-qa-gurugram-hq-2026052710320963',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-05-27',
    closingDate: null,
    jobDescription: 'Senior Engineer - Solution QA',
  })

  assert.deepEqual(greyorange.extractPaginationSummary(SEARCH_RESPONSE_PAYLOAD), {
    hasNext: true,
    pageSize: 9,
    totalCount: 84,
  })

  assert.deepEqual(greyorange.extractJobDetail(DETAIL_RESPONSE_PAYLOAD, listings[0]), {
    title: 'Software Development Engineer in Test II',
    company: 'GreyOrange',
    department: 'GreyMatter Quality Assurance',
    location: 'Gurugram - HQ',
    city: 'Gurugram',
    country: null,
    jobId: '10339',
    requisitionId: '10339',
    sourceUrl: 'https://careers.greyorange.com/greyorange/jobview/senior-engineer-solution-qa-gurugram-hq-2026052710320963',
    applyUrl: 'https://careers.greyorange.com/greyorange/jobview/senior-engineer-solution-qa-gurugram-hq-2026052710320963',
    employmentType: null,
    experienceRequired: '3-6 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Python',
      'Quality Engineer',
      'Pytest',
      'Performance Testing',
      'linux',
      'API Automation',
      'Ci/Cd',
      'GIT Version Control',
    ],
    postingDate: '2026-05-27',
    closingDate: null,
    jobDescription:
      'As a Senior Engineer in Solution QA at GreyOrange, you will play a vital role in ensuring the quality and reliability of our cutting-edge robotic solutions.',
  })
})

test('GreyOrange run validates the verified first-party careers page before fetching the public Zwayam search and detail APIs', async () => {
  const greyorange = await loadModule()
  const requested = []

  const jobs = await greyorange.createGreyOrangeScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === greyorange.CAREERS_URL) return VERIFIED_CAREERS_HTML
      throw new Error(`Unexpected GreyOrange text fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })

      if (url === greyorange.COMPANY_CONFIG_URL) return COMPANY_CONFIG_PAYLOAD
      if (url === greyorange.SEARCH_API_URL) {
        assert.equal(options.method, 'POST')
        assert.equal(options.body.get('companyId'), 'MTYwOTA=')
        assert.equal(options.body.get('domain'), 'careers.greyorange.com')
        assert.deepEqual(JSON.parse(options.body.get('filterCri')), {
          selectedCall: 'sort',
          paginationStartNo: 0,
          sortCriteria: {
            name: 'modifiedDate',
            isAscending: false,
          },
          anyOfTheseWords: '',
        })
        return SEARCH_RESPONSE_PAYLOAD
      }
      if (url === greyorange.DETAIL_API_URL) {
        assert.equal(options.method, 'POST')
        assert.deepEqual(JSON.parse(options.body), {
          jobUrl: 'senior-engineer-solution-qa-gurugram-hq-2026052710320963',
          externalSource: 'CareerSite',
          campusUrl: 'empty',
          companyId: '16090',
        })
        return DETAIL_RESPONSE_PAYLOAD
      }

      throw new Error(`Unexpected GreyOrange JSON fixture URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(
    requested.map((request) => [request.type, request.url]),
    [
      ['text', greyorange.CAREERS_URL],
      ['json', greyorange.COMPANY_CONFIG_URL],
      ['json', greyorange.SEARCH_API_URL],
      ['json', greyorange.DETAIL_API_URL],
    ],
  )
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'greyorange')
  assert.equal(jobs[0].company, 'GreyOrange')
  assert.equal(
    jobs[0].link,
    'https://careers.greyorange.com/greyorange/jobview/senior-engineer-solution-qa-gurugram-hq-2026052710320963',
  )
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('GreyOrange fails closed when the verified careers page, company configuration, or detail payload drift materially', async () => {
  const greyorange = await loadModule()

  await assert.rejects(
    greyorange.createGreyOrangeScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
      fetchJson: async () => COMPANY_CONFIG_PAYLOAD,
    }),
    /verified GreyOrange careers page/i,
  )

  await assert.rejects(
    greyorange.createGreyOrangeScraper().run({
      fetchText: async () => VERIFIED_CAREERS_HTML,
      fetchJson: async (url) => {
        if (url === greyorange.COMPANY_CONFIG_URL) {
          return {
            ...COMPANY_CONFIG_PAYLOAD,
            reponseObject: {
              ...COMPANY_CONFIG_PAYLOAD.reponseObject,
              company: {
                ...COMPANY_CONFIG_PAYLOAD.reponseObject.company,
                companyName: 'Other Company',
              },
            },
          }
        }
        throw new Error(`Unexpected GreyOrange JSON fixture URL: ${url}`)
      },
    }),
    /verified GreyOrange careers configuration/i,
  )

  await assert.rejects(
    greyorange.createGreyOrangeScraper({ maxJobs: 1 }).run({
      fetchText: async () => VERIFIED_CAREERS_HTML,
      fetchJson: async (url) => {
        if (url === greyorange.COMPANY_CONFIG_URL) return COMPANY_CONFIG_PAYLOAD
        if (url === greyorange.SEARCH_API_URL) return SEARCH_RESPONSE_PAYLOAD
        if (url === greyorange.DETAIL_API_URL) return { jobTitle: null, jobConfigurationData: {} }
        throw new Error(`Unexpected GreyOrange JSON fixture URL: ${url}`)
      },
    }),
    /verified GreyOrange detail payload/i,
  )
})
