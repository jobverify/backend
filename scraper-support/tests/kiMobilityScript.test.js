import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Ki Mobility - Careers</title>
  </head>
  <body>
    <main>
      <h1>Careers at Ki</h1>
      <p>If you truly want a career with a purpose, apply with us today.</p>
      <a href="https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=d4c8f64f-44e0-49a4-95d7-5c8d1767e36d&ccId=19000101_000001&lang=en_US">
        Explore our career opportunities and apply
      </a>
    </main>
  </body>
</html>
`

const adpBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Recruitment</title>
  </head>
  <body id="wfn_body" class="mdf recruitment-body">
    <div id="recruitment_root"></div>
    <script>
      window.loaderConfig = {
        applicationPath: '/mascsr/default/mdf/recruitment',
        applicationName: 'recruitment',
      }
    </script>
    <script src="/mascsr/default/mdf/recruitment/recruitment.9435522dae2c6de7.js"></script>
  </body>
</html>
`

const searchFiltersPayload = {
  data: [
    {
      filterType: 'FILTER LOCATION',
      searchFilterInfo: [
        { oid: 'Chicago - IL', value: 'Chicago, IL' },
        { oid: 'United States (Countrywide)', value: 'US,LOCATION_COUNTRY' },
      ],
    },
    {
      filterType: 'FILTER JOB TYPE',
      searchFilterInfo: [
        { oid: '1:135', value: 'Full Time' },
      ],
    },
  ],
  status: 'success',
  props: [],
  isReadOnly: false,
}

const indiaRole = {
  itemID: '9200999999999_1',
  requisitionTitle: 'Field Service Engineer',
  postDate: '2026-07-10T10:00:00.000-04:00',
  workLevelCode: { shortName: 'Full Time' },
  customFieldGroup: {
    stringFields: [
      { stringValue: '700001', nameCode: { codeValue: 'ExternalJobID' } },
      { stringValue: '', nameCode: { codeValue: 'HomeDepartment' } },
    ],
  },
  clientRequisitionID: '1701',
  requisitionLocations: [
    {
      address: {
        cityName: 'Mumbai',
        countrySubdivisionLevel1: { codeValue: 'MH' },
      },
      nameCode: { shortName: ' Mumbai, MH, IN' },
    },
  ],
}

const usRole = {
  itemID: '9200959784267_1',
  requisitionTitle: 'Regional Sales Manager',
  postDate: '2026-07-01T13:44:00.000-04:00',
  workLevelCode: { shortName: 'Full Time' },
  customFieldGroup: {
    stringFields: [
      { stringValue: '614530', nameCode: { codeValue: 'ExternalJobID' } },
    ],
  },
  clientRequisitionID: '1618',
  requisitionLocations: [
    {
      address: {
        cityName: 'Stevens Point',
        countrySubdivisionLevel1: { codeValue: 'WI' },
      },
      nameCode: { shortName: ' Stevens Point, WI, US' },
    },
  ],
}

const indiaRoleDetail = {
  requisitionDescription:
    '<p>Install and support mobility products across hospitals.</p><ul><li>Travel across India.</li></ul><p>3+ years of field service experience.</p>',
}

const liveBoardWithoutIndiaPayload = {
  jobRequisitions: [
    usRole,
    {
      itemID: '9200911683410_1',
      requisitionTitle: 'Senior Accountant',
      postDate: '2026-01-28T09:41:00.000-05:00',
      workLevelCode: { shortName: 'Full Time' },
      customFieldGroup: {
        stringFields: [
          { stringValue: '584310', nameCode: { codeValue: 'ExternalJobID' } },
        ],
      },
      clientRequisitionID: '1592',
      requisitionLocations: [
        {
          address: {
            cityName: 'Stevens Point',
            countrySubdivisionLevel1: { codeValue: 'WI' },
          },
          nameCode: { shortName: ' Stevens Point, WI, US' },
        },
      ],
    },
  ],
  meta: {
    totalNumber: 2,
  },
}

const loadModule = async () => {
  try {
    return await import('../../scraper/kimobility/script.js')
  } catch {
    assert.fail('Expected Ki Mobility scraper module at ../../scraper/kimobility/script.js')
  }
}

test('Ki Mobility helpers stay pinned to the verified careers handoff and public ADP endpoints', async () => {
  const kiMobility = await loadModule()

  assert.equal(kiMobility.SOURCE, 'kimobility')
  assert.equal(kiMobility.COMPANY, 'Ki Mobility')
  assert.equal(kiMobility.OFFICIAL_BRAND_NAME, 'Ki Mobility')
  assert.equal(kiMobility.VERIFIED_ON, '2026-07-16')
  assert.equal(kiMobility.CAREERS_PAGE_URL, 'https://www.kimobility.com/careers')
  assert.equal(
    kiMobility.ADP_BOARD_URL,
    'https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=d4c8f64f-44e0-49a4-95d7-5c8d1767e36d&ccId=19000101_000001&lang=en_US',
  )
  assert.equal(
    kiMobility.buildJobsApiUrl(),
    'https://workforcenow.adp.com/mascsr/default/careercenter/public/events/staffing/v1/job-requisitions?cid=d4c8f64f-44e0-49a4-95d7-5c8d1767e36d&ccId=19000101_000001&lang=en_US&locale=en_US&$top=100',
  )
  assert.equal(
    kiMobility.buildSearchFiltersApiUrl(),
    'https://workforcenow.adp.com/mascsr/default/careercenter/public/events/staffing/v1/job-requisitions/getSearchFilters?cid=d4c8f64f-44e0-49a4-95d7-5c8d1767e36d&ccId=19000101_000001&lang=en_US&locale=en_US',
  )
  assert.equal(
    kiMobility.buildDetailApiUrl('700001'),
    'https://workforcenow.adp.com/mascsr/default/careercenter/public/events/staffing/v1/job-requisitions/700001?cid=d4c8f64f-44e0-49a4-95d7-5c8d1767e36d&ccId=19000101_000001&lang=en_US&locale=en_US',
  )
  assert.equal(
    kiMobility.buildJobDetailUrl('700001'),
    'https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=d4c8f64f-44e0-49a4-95d7-5c8d1767e36d&ccId=19000101_000001&lang=en_US&jobId=700001',
  )
  assert.equal(kiMobility.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(
    kiMobility.extractOfficialJobsBoardUrl(careersPageHtml),
    kiMobility.ADP_BOARD_URL,
  )
  assert.equal(kiMobility.hasOfficialAdpBoardSignal(adpBoardHtml), true)
  assert.deepEqual(kiMobility.extractLocationFilterValues(searchFiltersPayload), [
    'Chicago, IL',
    'United States (Countrywide)',
  ])

  assert.deepEqual(kiMobility.extractIndiaJobSummaries({
    jobRequisitions: [indiaRole, usRole],
  }), [
    {
      title: 'Field Service Engineer',
      company: 'Ki Mobility',
      department: null,
      location: 'Mumbai, MH, India',
      city: 'Mumbai',
      state: 'MH',
      country: 'India',
      jobId: '700001',
      requisitionId: '1701',
      sourceUrl:
        'https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=d4c8f64f-44e0-49a4-95d7-5c8d1767e36d&ccId=19000101_000001&lang=en_US&jobId=700001',
      applyUrl:
        'https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=d4c8f64f-44e0-49a4-95d7-5c8d1767e36d&ccId=19000101_000001&lang=en_US&jobId=700001',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-10T10:00:00.000-04:00',
      closingDate: null,
      jobDescription: null,
    },
  ])
})

test('Ki Mobility run validates the verified public ADP contract and returns only India jobs', async () => {
  const kiMobility = await loadModule()
  const requestedPages = []
  const requestedJson = []

  const jobs = await kiMobility.createKiMobilityScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedPages.push(url)

      if (url === kiMobility.CAREERS_PAGE_URL) return careersPageHtml
      if (url === kiMobility.ADP_BOARD_URL) return adpBoardHtml

      assert.fail(`Unexpected Ki Mobility HTML request: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)

      if (url === kiMobility.buildSearchFiltersApiUrl()) return searchFiltersPayload
      if (url === kiMobility.buildJobsApiUrl()) {
        return { jobRequisitions: [indiaRole, usRole], meta: { totalNumber: 2 } }
      }
      if (url === kiMobility.buildDetailApiUrl('700001')) return indiaRoleDetail

      assert.fail(`Unexpected Ki Mobility JSON request: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [
    kiMobility.CAREERS_PAGE_URL,
    kiMobility.ADP_BOARD_URL,
  ])
  assert.deepEqual(requestedJson, [
    kiMobility.buildSearchFiltersApiUrl(),
    kiMobility.buildJobsApiUrl(),
    kiMobility.buildDetailApiUrl('700001'),
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Field Service Engineer',
      company: 'Ki Mobility',
      department: null,
      location: 'Mumbai, MH, India',
      city: 'Mumbai',
      state: 'MH',
      country: 'India',
      jobId: '700001',
      requisitionId: '1701',
      sourceUrl:
        'https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=d4c8f64f-44e0-49a4-95d7-5c8d1767e36d&ccId=19000101_000001&lang=en_US&jobId=700001',
      applyUrl:
        'https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=d4c8f64f-44e0-49a4-95d7-5c8d1767e36d&ccId=19000101_000001&lang=en_US&jobId=700001',
      employmentType: 'Full-time',
      experienceRequired: '3+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-10T10:00:00.000-04:00',
      closingDate: null,
      jobDescription:
        'Install and support mobility products across hospitals. Travel across India. 3+ years of field service experience.',
      source: 'kimobility',
      link:
        'https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=d4c8f64f-44e0-49a4-95d7-5c8d1767e36d&ccId=19000101_000001&lang=en_US&jobId=700001',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Ki Mobility run returns an honest zero-job result while the verified public ADP board exposes no India roles', async () => {
  const kiMobility = await loadModule()
  const requestedJson = []

  const jobs = await kiMobility.createKiMobilityScraper().run({
    fetchText: async (url) => {
      if (url === kiMobility.CAREERS_PAGE_URL) return careersPageHtml
      if (url === kiMobility.ADP_BOARD_URL) return adpBoardHtml

      assert.fail(`Unexpected Ki Mobility HTML request: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)

      if (url === kiMobility.buildSearchFiltersApiUrl()) return searchFiltersPayload
      if (url === kiMobility.buildJobsApiUrl()) return liveBoardWithoutIndiaPayload

      assert.fail(`Unexpected Ki Mobility JSON request: ${url}`)
    },
  })

  assert.deepEqual(requestedJson, [
    kiMobility.buildSearchFiltersApiUrl(),
    kiMobility.buildJobsApiUrl(),
  ])
  assert.deepEqual(jobs, [])
})

test('Ki Mobility fails closed when the verified careers surface or ADP board changes materially', async () => {
  const kiMobility = await loadModule()

  await assert.rejects(
    kiMobility.createKiMobilityScraper().run({
      fetchText: async (url) => {
        if (url === kiMobility.CAREERS_PAGE_URL) {
          return '<html><body><h1>Careers</h1></body></html>'
        }

        return adpBoardHtml
      },
      fetchJson: async () => searchFiltersPayload,
    }),
    /verified official Ki Mobility careers page/i,
  )

  await assert.rejects(
    kiMobility.createKiMobilityScraper().run({
      fetchText: async (url) => {
        if (url === kiMobility.CAREERS_PAGE_URL) return careersPageHtml
        return '<html><body><h1>Board changed</h1></body></html>'
      },
      fetchJson: async () => searchFiltersPayload,
    }),
    /verified public Ki Mobility ADP board/i,
  )
})
