import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-01T12:00:00.000Z'

const practoCareersHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Practo | Careers</title>
    <meta name="description" content="Practo Careers">
    <base href="/practo/">
  </head>
  <body>
    <app-root></app-root>
    <button id="current_openings">Current Openings</button>
    <script src="runtime.8062548306377782.js" type="module"></script>
    <script src="polyfills.712cec7b40080dce.js" type="module"></script>
    <script src="main.29cb0dfa789c383c.js" type="module"></script>
  </body>
</html>
`

const pageOneSearchPayload = {
  data: {
    data: [
      {
        _source: {
          jobTitle: 'Creative Strategist Manager',
          jobUrl: 'creative-strategist-manager-bengaluru-karnataka-india-2026062919200350',
          referenceNumber: '10002',
          departmentName: 'Central',
          locAgg: 'Bengaluru, Karnataka, India',
          text4: 'Permanent',
          desiredSkillList: ['Creative Strategy', 'Brand Strategist'],
          skillsToEvaluateList: ['Creative Content', 'Content Strategy'],
          minYearOfExperience: 4,
          maxYearOfExperience: 8,
          createDate: 1780901908000,
          shortDescriptionWithoutHtml: 'Lead Practo creative direction',
        },
      },
      {
        _source: {
          jobTitle: 'Head Customer Support',
          jobUrl: 'head-customer-support-bengaluru-karnataka-india-2026071512583918',
          referenceNumber: '10015',
          DepartmentName: 'Support',
          locAgg: 'Bengaluru, Karnataka, India',
          desiredSkill: 'Head Customer Service, Call Center Operations, Customer Support Manager',
          minYearOfExperience: 8,
          maxYearOfExperience: 15,
          createDate: '2026-07-15T12:58:39.000Z',
          shortDescription: '<p>Lead customer support operations</p>',
        },
      },
    ],
    hasMoreData: true,
    totalCount: 3,
    facetedSearchConfig: {
      paginationHowMuch: '2',
    },
  },
}

const pageTwoSearchPayload = {
  data: {
    data: [
      {
        _source: {
          jobTitle: 'Product Manager',
          jobUrl: 'product-manager-bengaluru-karnataka-india-2026073009150001',
          referenceNumber: '10021',
          departmentName: 'Product',
          locAgg: 'Bengaluru, Karnataka, India',
          text4: 'Permanent',
          experienceUIField: '3 - 6 years',
          desiredSkillList: ['Product Management', 'Product Roadmap'],
          createDate: 1781020800000,
          shortDescriptionWithoutHtml: 'Own product roadmap',
        },
      },
    ],
    hasMoreData: false,
    totalCount: 3,
    facetedSearchConfig: {
      paginationHowMuch: '2',
    },
  },
}

const hiddenClosedSearchPayload = {
  data: {
    data: [
      {
        _source: {
          jobTitle: 'Old Hidden Role',
          referenceNumber: '99999',
          otherStatusOne: 'Hidden',
          otherStatusTwo: 'Closed',
          requisitionStatus: 'A',
          appliesNotBlocked: 0,
        },
      },
    ],
  },
}

const creativeStrategistDetailPayload = {
  jobCode: '10002',
  referenceNumber: '10002',
  jobUrl: 'creative-strategist-manager-bengaluru-karnataka-india-2026062919200350',
  jobTitle: 'Creative Strategist Manager',
  departmentName: 'Central',
  location: 'Bengaluru, Karnataka, India',
  eduqualification: 'Graduate',
  longDescription: '<p>Lead the internal creative team.</p>',
  role: '<ul><li>Own YouTube and Meta</li><li>6-9 years in content</li></ul>',
  desiredSkill: 'Creative Strategy, Brand Strategist',
  createdDate: 1780901908000,
  minYrsOfExperience: 4,
  maxYrsOfExperience: 8,
}

const productManagerDetailPayload = {
  jobCode: '10021',
  referenceNumber: '10021',
  jobUrl: 'product-manager-bengaluru-karnataka-india-2026073009150001',
  jobTitle: 'Product Manager',
  departmentName: 'Product',
  location: 'Bengaluru, Karnataka, India',
  jobConfigurationData: {
    'Education/Qualification': 'B.E. / B.Tech',
    'Skills Required': 'Product Management, Product Roadmap',
  },
  longDescription: '<p>Own the roadmap.</p>',
  role: '<ul><li>Partner with engineering</li></ul>',
  createdDate: 1781020800000,
  yrsOfExperience: '3 - 6 years',
}

const loadPractoModule = async () => {
  try {
    return await import('../../scraper/practo/script.js')
  } catch {
    assert.fail('Expected Practo scraper module at ../../scraper/practo/script.js')
  }
}

test('Practo script exposes the verified careers shell and live Zwayam search contract', async () => {
  const practo = await loadPractoModule()

  assert.equal(practo.SOURCE, 'practo')
  assert.equal(practo.COMPANY, 'Practo')
  assert.equal(practo.OFFICIAL_BRAND_NAME, 'Practo')
  assert.equal(practo.VERIFIED_ON, '2026-08-01')
  assert.equal(practo.OFFICIAL_CAREERS_URL, 'https://careers.practo.com/practo/')
  assert.equal(practo.SEARCH_API_URL, 'https://public.zwayam.com/jobs/search')
  assert.equal(practo.DETAIL_API_URL, 'https://public.zwayam.com/jobs-service/v1/jobs/careersite')
  assert.equal(practo.ZWAYAM_COMPANY_ID, 'MTYzMDI=')
  assert.equal(practo.ZWAYAM_DETAIL_COMPANY_ID, '16302')
  assert.equal(typeof practo.buildSearchPayload, 'function')
  assert.equal(typeof practo.extractSearchResults, 'function')
  assert.equal(typeof practo.extractPaginationSummary, 'function')
  assert.equal(typeof practo.buildDetailRequest, 'function')
  assert.equal(typeof practo.buildJobDetailUrl, 'function')
  assert.equal(typeof practo.createPractoScraper, 'function')

  const searchPayload = practo.buildSearchPayload({ paginationStartNo: 9 })
  assert.equal(searchPayload.domain, 'careers.practo.com')
  assert.equal(searchPayload.companyId, 'MTYzMDI=')
  assert.deepEqual(JSON.parse(searchPayload.filterCri), {
    paginationStartNo: 9,
    selectedCall: 'sort',
    sortCriteria: {
      name: 'modifiedDate',
      isAscending: false,
    },
    anyOfTheseWords: '',
  })

  assert.equal(practo.hasVerifiedCareersShellSignals(practoCareersHtml), true)
  assert.equal(
    practo.hasVerifiedCareersShellSignals('<html><body>No trusted Practo careers shell</body></html>'),
    false,
  )

  assert.equal(practo.extractSearchRecords(pageOneSearchPayload).length, 2)
  assert.deepEqual(practo.extractPaginationSummary(pageOneSearchPayload), {
    hasNext: true,
    pageSize: 2,
    totalCount: 3,
  })

  const listings = practo.extractSearchResults(pageOneSearchPayload)
  assert.equal(listings.length, 2)
  assert.equal(
    listings[0].sourceUrl,
    'https://careers.practo.com/practo/jobview/creative-strategist-manager-bengaluru-karnataka-india-2026062919200350',
  )
  assert.equal(listings[0].experienceRequired, '4 - 8 years')
  assert.deepEqual(listings[0].requiredSkills, [
    'Creative Strategy',
    'Brand Strategist',
    'Creative Content',
    'Content Strategy',
  ])

  assert.deepEqual(practo.buildDetailRequest(pageOneSearchPayload.data.data[0]._source), {
    jobUrl: 'creative-strategist-manager-bengaluru-karnataka-india-2026062919200350',
    externalSource: 'CareerSite',
    campusUrl: 'empty',
    companyId: '16302',
  })

  assert.equal(practo.allSearchRecordsAreSuppressed(hiddenClosedSearchPayload), true)
})

test('Practo run paginates the live public Zwayam search and enriches jobs with detail records', async () => {
  const { OFFICIAL_CAREERS_URL, SEARCH_API_URL, DETAIL_API_URL, createPractoScraper } = await loadPractoModule()
  const requests = []

  const jobs = await createPractoScraper({
    now: () => FIXED_SCRAPED_AT,
    maxPages: 5,
  }).run({
    fetchText: async (url) => {
      requests.push({ url, type: 'text' })
      if (url === OFFICIAL_CAREERS_URL) return practoCareersHtml
      throw new Error(`Unexpected text URL ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requests.push({ url, type: 'json', options })

      if (url === SEARCH_API_URL && options.form?.companyId === 'MTYzMDI=') {
        const paginationStartNo = JSON.parse(options.form.filterCri).paginationStartNo
        if (paginationStartNo === 0) return pageOneSearchPayload
        if (paginationStartNo === 2) return pageTwoSearchPayload
      }

      if (url === DETAIL_API_URL && options.json?.jobUrl === 'creative-strategist-manager-bengaluru-karnataka-india-2026062919200350') {
        return creativeStrategistDetailPayload
      }

      if (url === DETAIL_API_URL && options.json?.jobUrl === 'head-customer-support-bengaluru-karnataka-india-2026071512583918') {
        throw new Error('Transient detail failure')
      }

      if (url === DETAIL_API_URL && options.json?.jobUrl === 'product-manager-bengaluru-karnataka-india-2026073009150001') {
        return productManagerDetailPayload
      }

      throw new Error(`Unexpected JSON request ${url}`)
    },
  })

  assert.equal(jobs.length, 3)

  assert.deepEqual(
    jobs.map((job) => job.jobId),
    ['10002', '10015', '10021'],
  )

  const creativeStrategistRole = jobs.find((job) => job.jobId === '10002')
  assert.equal(creativeStrategistRole.minimumQualification, 'Graduate')
  assert.equal(creativeStrategistRole.experienceRequired, '4 - 8 years')
  assert.equal(creativeStrategistRole.location, 'Bengaluru, Karnataka, India')
  assert.equal(creativeStrategistRole.city, 'Bengaluru')
  assert.match(creativeStrategistRole.jobDescription, /Lead the internal creative team\./)
  assert.match(creativeStrategistRole.jobDescription, /Own YouTube and Meta/)
  assert.deepEqual(creativeStrategistRole.requiredSkills, [
    'Creative Strategy',
    'Brand Strategist',
  ])
  assert.equal(creativeStrategistRole.link, creativeStrategistRole.applyUrl)
  assert.equal(creativeStrategistRole.scrapedAt, FIXED_SCRAPED_AT)

  const supportRole = jobs.find((job) => job.jobId === '10015')
  assert.equal(supportRole.minimumQualification, null)
  assert.equal(supportRole.experienceRequired, '8 - 15 years')
  assert.match(supportRole.jobDescription, /Lead customer support operations/)
  assert.deepEqual(supportRole.requiredSkills, [
    'Head Customer Service',
    'Call Center Operations',
    'Customer Support Manager',
  ])

  const productManagerRole = jobs.find((job) => job.jobId === '10021')
  assert.equal(productManagerRole.department, 'Product')
  assert.equal(productManagerRole.minimumQualification, 'B.E. / B.Tech')
  assert.equal(productManagerRole.experienceRequired, '3 - 6 years')
  assert.deepEqual(productManagerRole.requiredSkills, [
    'Product Management',
    'Product Roadmap',
  ])
  assert.match(productManagerRole.jobDescription, /Own the roadmap\./)
  assert.match(productManagerRole.jobDescription, /Partner with engineering/)

  assert.equal(requests[0].url, OFFICIAL_CAREERS_URL)
  assert.equal(requests[1].url, SEARCH_API_URL)
  assert.equal(JSON.parse(requests[1].options.form.filterCri).paginationStartNo, 0)
  assert.equal(requests[4].url, SEARCH_API_URL)
  assert.equal(JSON.parse(requests[4].options.form.filterCri).paginationStartNo, 2)
})

test('Practo fails closed when the verified careers shell drifts', async () => {
  const { createPractoScraper } = await loadPractoModule()

  await assert.rejects(
    createPractoScraper().run({
      fetchText: async () => '<html><body>Unexpected shell</body></html>',
      fetchJson: async () => pageOneSearchPayload,
    }),
    /verified careers shell/i,
  )
})
