import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-27T00:00:00.000Z'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Solar Group</title>
  </head>
  <body>
    <nav>
      <a href="https://careers.solargroup.com/#!/">Careers</a>
    </nav>
    <section>
      <h2>Defence</h2>
      <h2>Mining</h2>
    </section>
  </body>
</html>
`

const boardShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Solar Industries India Limited"</title>
    <base href="/solargroup/">
  </head>
  <body>
    <app-root></app-root>
    <script src="runtime.5a77279bf312fcfc.js"></script>
    <script src="polyfills.74a269da9218ec1f.js"></script>
    <script src="main.9989675970f1433e.js"></script>
  </body>
</html>
`

const firstListingRecord = {
  jobTitle: 'Sr. Executive',
  designation: 'Navigation Engineer',
  jobUrl: 'sr-executive-uav-2024122016373073',
  jobCode: 520,
  referenceNumber: '520',
  location: 'UAV',
  locAgg: 'UAV',
  DepartmentName: 'UAV',
  createdDate: 1725881077000,
  yrsOfExperience: '0 to 3 Years ',
  skillSet: 'Programming, Communication Engineering, Telecommunication',
  otherStatusOne: 'Hidden',
  otherStatusTwo: 'Closed',
  displayStatus: 'Open',
  jobVisibility: 'Limited',
  jobLocationRecord: [],
}

const secondListingRecord = {
  jobTitle: 'Assistant Manager',
  designation: 'Simulation Engineer - Structural FEA',
  jobUrl: 'assistant-manager-defence-2024082714423378',
  jobCode: 487,
  referenceNumber: '487',
  location: 'Defence',
  locAgg: 'Defence',
  DepartmentName: 'Defence',
  createdDate: 1723639694000,
  yrsOfExperience: '3 to 8 Years ',
  skillSet: 'ANSYS, FEA',
  otherStatusOne: 'Hidden',
  otherStatusTwo: 'Closed',
  displayStatus: 'Open',
  jobVisibility: 'Limited',
  jobLocationRecord: [],
}

const listingPayload = {
  data: {
    data: [
      { _source: firstListingRecord },
      { _source: secondListingRecord },
    ],
    hasMoreData: false,
    facetedSearchConfig: {
      paginationHowMuch: '9',
    },
    totalCount: 4,
  },
}

const firstDetailPayload = {
  jobTitle: 'Sr. Executive',
  designation: 'Navigation Engineer',
  jobCode: 520,
  jobUrl: 'sr-executive-uav-2024122016373073',
  referenceNumber: '520',
  departmentName: 'UAV',
  location: 'UAV',
  locationDisplayForManageJobs: 'UAV',
  createdDate: 1725881077000,
  minYrsOfExperience: '0',
  maxYrsOfExperience: '3',
  skillSet: 'Programming, Communication Engineering, Telecommunication',
  longDescription:
    '<p>Develop GNSS based navigation systems for predefined flight paths.</p>',
}

const secondDetailPayload = {
  jobTitle: 'Assistant Manager',
  designation: 'Simulation Engineer - Structural FEA',
  jobCode: 487,
  jobUrl: 'assistant-manager-defence-2024082714423378',
  referenceNumber: '487',
  departmentName: 'Defence',
  location: 'Defence',
  locationDisplayForManageJobs: 'Defence',
  createdDate: 1723639694000,
  minYrsOfExperience: '3',
  maxYrsOfExperience: '8',
  skillSet: 'ANSYS, FEA',
  longDescription:
    '<p>Drive structural simulation and finite element analysis for defence programs.</p>',
}

const loadSolarIndustriesIndiaModule = async () => {
  try {
    return await import('../../scraper/solarindustriesindia/script.js')
  } catch {
    assert.fail('Expected Solar Industries India scraper module at ../../scraper/solarindustriesindia/script.js')
  }
}

test('Solar Industries India pins the verified homepage handoff, first-party board shell, and public Zwayam endpoints', async () => {
  const solarIndustriesIndia = await loadSolarIndustriesIndiaModule()

  assert.equal(solarIndustriesIndia.SOURCE, 'solarindustriesindia')
  assert.equal(solarIndustriesIndia.COMPANY, 'Solar Industries India')
  assert.equal(solarIndustriesIndia.HOMEPAGE_URL, 'https://www.solargroup.com/')
  assert.equal(solarIndustriesIndia.HOMEPAGE_CAREERS_ENTRY_URL, 'https://careers.solargroup.com/#!/')
  assert.equal(solarIndustriesIndia.CAREERS_BOARD_URL, 'https://careers.solargroup.com/solargroup/')
  assert.equal(
    solarIndustriesIndia.SAMPLE_JOB_VIEW_URL,
    'https://careers.solargroup.com/solargroup/jobview/sr-executive-uav-2024122016373073',
  )
  assert.equal(solarIndustriesIndia.SEARCH_API_URL, 'https://public.zwayam.com/jobs/search')
  assert.equal(solarIndustriesIndia.DETAIL_API_URL, 'https://public.zwayam.com/jobs-service/v1/jobs/careersite')
  assert.equal(solarIndustriesIndia.ZWAYAM_DOMAIN, 'careers.solargroup.com')
  assert.equal(solarIndustriesIndia.SEARCH_COMPANY_ID, 'MTU0Nzg=')
  assert.equal(solarIndustriesIndia.DETAIL_COMPANY_ID, '15478')
  assert.equal(solarIndustriesIndia.VERIFIED_AT, '2026-07-27')

  assert.equal(solarIndustriesIndia.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(
    solarIndustriesIndia.extractHomepageCareersEntryUrl(homepageHtml),
    'https://careers.solargroup.com/#!/',
  )
  assert.equal(solarIndustriesIndia.hasCareersBoardShellSignal(boardShellHtml), true)

  assert.deepEqual(solarIndustriesIndia.buildSearchPayload(), {
    filterCri: JSON.stringify({
      paginationStartNo: 0,
      selectedCall: 'sort',
      sortCriteria: {
        name: 'modifiedDate',
        isAscending: false,
      },
      anyOfTheseWords: '',
    }),
    domain: 'careers.solargroup.com',
    companyId: 'MTU0Nzg=',
  })

  assert.deepEqual(solarIndustriesIndia.buildSearchPayload({ page: 2 }), {
    filterCri: JSON.stringify({
      paginationStartNo: 9,
      selectedCall: 'sort',
      sortCriteria: {
        name: 'modifiedDate',
        isAscending: false,
      },
      anyOfTheseWords: '',
    }),
    domain: 'careers.solargroup.com',
    companyId: 'MTU0Nzg=',
  })

  assert.equal(
    solarIndustriesIndia.buildJobDetailUrl('sr-executive-uav-2024122016373073'),
    'https://careers.solargroup.com/solargroup/jobview/sr-executive-uav-2024122016373073',
  )

  assert.deepEqual(solarIndustriesIndia.buildDetailRequest(firstListingRecord), {
    jobUrl: 'sr-executive-uav-2024122016373073',
    externalSource: 'CAREERSITE',
    campusUrl: 'empty',
    companyId: '15478',
  })
})

test('Solar Industries India can use the verified public API during the board host TLS alert without disabling certificate checks', async () => {
  const solar = await loadSolarIndustriesIndiaModule()
  const jobs = await solar.createSolarIndustriesIndiaScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      if (url === solar.HOMEPAGE_URL) return homepageHtml
      const error = new Error('fetch failed: tlsv1 alert internal error')
      throw error
    },
    fetchJson: async (url) => {
      if (url === solar.SEARCH_API_URL) return listingPayload
      if (url === solar.DETAIL_API_URL) return firstDetailPayload
      throw new Error(`Unexpected API URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '520')
  assert.equal(solar.hasVerifiedCareersBoardTlsFailure(new Error('certificate has expired')), false)
})

test('Solar Industries India treats the current public Zwayam listing contract as enumerable even when the flags still say Hidden Closed Limited', async () => {
  const solarIndustriesIndia = await loadSolarIndustriesIndiaModule()

  const jobs = solarIndustriesIndia.extractSearchResults(listingPayload)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Sr. Executive - Navigation Engineer',
    company: 'Solar Industries India',
    department: 'UAV',
    location: 'India',
    city: null,
    jobId: '520',
    requisitionId: '520',
    sourceUrl:
      'https://careers.solargroup.com/solargroup/jobview/sr-executive-uav-2024122016373073',
    applyUrl:
      'https://careers.solargroup.com/solargroup/jobview/sr-executive-uav-2024122016373073',
    employmentType: null,
    experienceRequired: '0-3 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Programming', 'Communication Engineering', 'Telecommunication'],
    postingDate: '2024-09-09',
    closingDate: null,
    jobDescription: null,
    _listingRecord: firstListingRecord,
  })

  assert.deepEqual(solarIndustriesIndia.extractPaginationSummary(listingPayload), {
    hasNext: false,
    pageSize: 9,
    totalCount: 4,
  })
})

test('Solar Industries India detail extraction keeps first-party jobview links and enriches the public listing contract', async () => {
  const solarIndustriesIndia = await loadSolarIndustriesIndiaModule()

  const detail = solarIndustriesIndia.extractJobDetail(firstDetailPayload, {
    title: 'Sr. Executive - Navigation Engineer',
    department: 'UAV',
    location: 'India',
    city: null,
    jobId: '520',
    requisitionId: '520',
    sourceUrl:
      'https://careers.solargroup.com/solargroup/jobview/sr-executive-uav-2024122016373073',
    applyUrl:
      'https://careers.solargroup.com/solargroup/jobview/sr-executive-uav-2024122016373073',
    _listingRecord: firstListingRecord,
  })

  assert.deepEqual(detail, {
    title: 'Sr. Executive - Navigation Engineer',
    company: 'Solar Industries India',
    department: 'UAV',
    location: 'India',
    city: null,
    jobId: '520',
    requisitionId: '520',
    sourceUrl:
      'https://careers.solargroup.com/solargroup/jobview/sr-executive-uav-2024122016373073',
    applyUrl:
      'https://careers.solargroup.com/solargroup/jobview/sr-executive-uav-2024122016373073',
    employmentType: null,
    experienceRequired: '0-3 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Programming', 'Communication Engineering', 'Telecommunication'],
    postingDate: '2024-09-09',
    closingDate: null,
    jobDescription: 'Develop GNSS based navigation systems for predefined flight paths.',
  })
})

test('createSolarIndustriesIndiaScraper validates the homepage handoff, the board shell, and paginates the public Zwayam flow', async () => {
  const solarIndustriesIndia = await loadSolarIndustriesIndiaModule()
  const requestedPages = []
  const apiRequests = []
  const detailPayloads = [firstDetailPayload, secondDetailPayload]

  const jobs = await solarIndustriesIndia.createSolarIndustriesIndiaScraper().run({
    fetchText: async (url) => {
      requestedPages.push(url)

      if (url === solarIndustriesIndia.HOMEPAGE_URL) return homepageHtml
      if (url === solarIndustriesIndia.CAREERS_BOARD_URL) return boardShellHtml
      if (url === solarIndustriesIndia.SAMPLE_JOB_VIEW_URL) return boardShellHtml

      throw new Error(`Unexpected Solar Industries India page URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      apiRequests.push({ url, options })

      if (url === solarIndustriesIndia.SEARCH_API_URL) {
        return listingPayload
      }

      if (url === solarIndustriesIndia.DETAIL_API_URL) {
        return detailPayloads.shift()
      }

      throw new Error(`Unexpected Solar Industries India API URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedPages, [
    solarIndustriesIndia.HOMEPAGE_URL,
    solarIndustriesIndia.CAREERS_BOARD_URL,
    solarIndustriesIndia.SAMPLE_JOB_VIEW_URL,
  ])

  assert.deepEqual(apiRequests, [
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
          domain: 'careers.solargroup.com',
          companyId: 'MTU0Nzg=',
        },
      },
    },
    {
      url: 'https://public.zwayam.com/jobs-service/v1/jobs/careersite',
      options: {
        method: 'POST',
        json: {
          jobUrl: 'sr-executive-uav-2024122016373073',
          externalSource: 'CAREERSITE',
          campusUrl: 'empty',
          companyId: '15478',
        },
      },
    },
    {
      url: 'https://public.zwayam.com/jobs-service/v1/jobs/careersite',
      options: {
        method: 'POST',
        json: {
          jobUrl: 'assistant-manager-defence-2024082714423378',
          externalSource: 'CAREERSITE',
          campusUrl: 'empty',
          companyId: '15478',
        },
      },
    },
  ])

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].jobId, '520')
  assert.equal(jobs[0].title, 'Sr. Executive - Navigation Engineer')
  assert.equal(jobs[0].source, 'solarindustriesindia')
  assert.equal(jobs[0].company, 'Solar Industries India')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].companyCareerPage, 'https://careers.solargroup.com/solargroup/')
  assert.equal(jobs[0].companyDomain, 'solargroup.com')
  assert.equal(jobs[0].atsPlatform, 'zwayam')
  assert.equal(
    jobs[0].link,
    'https://careers.solargroup.com/solargroup/jobview/sr-executive-uav-2024122016373073',
  )
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[1].jobId, '487')
  assert.equal(jobs[1].title, 'Assistant Manager - Simulation Engineer - Structural FEA')
  assert.equal(jobs[1].scrapedAt, FIXED_SCRAPED_AT)
})

test('Solar Industries India fails closed when the verified homepage entry or board shell drifts', async () => {
  const solarIndustriesIndia = await loadSolarIndustriesIndiaModule()

  await assert.rejects(
    solarIndustriesIndia.createSolarIndustriesIndiaScraper().run({
      fetchText: async (url) => {
        if (url === solarIndustriesIndia.HOMEPAGE_URL) {
          return homepageHtml.replace('https://careers.solargroup.com/#!/', 'https://example.com/jobs')
        }

        return boardShellHtml
      },
    }),
    /homepage careers entry/i,
  )

  await assert.rejects(
    solarIndustriesIndia.createSolarIndustriesIndiaScraper().run({
      fetchText: async (url) => {
        if (url === solarIndustriesIndia.HOMEPAGE_URL) return homepageHtml
        if (url === solarIndustriesIndia.CAREERS_BOARD_URL) {
          return '<html><head><title>Placeholder</title></head><body>broken</body></html>'
        }

        return boardShellHtml
      },
    }),
    /careers board shell/i,
  )
})
