import assert from 'node:assert/strict'
import test from 'node:test'
import {withNativeDescription,worklinePDF,worklineDetailPage} from '../../test/helpers/worklineGoalFixture.js'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>SMFG India Credit: Leading Financial Company for Loans</title>
  </head>
  <body>
    <header>
      <a href="https://www.smfgindiacredit.com/">Home</a>
      <a href="https://www.smfgindiacredit.com/careers.aspx">Careers</a>
    </header>
    <main>
      <h1>SMFG India Credit</h1>
      <p>Trusted financial partner for millions of Indians since 2007</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>SMFG India Credit Careers - Current Job Openings & Employee Testimonials</title>
  </head>
  <body>
    <main>
      <h1>Careers - SMFG India Credit</h1>
      <p>Awarded as a "Great Place to Work"</p>
      <a href="https://app52.workline.hr/Candidate/GeneralOpening.aspx">Explore Jobs</a>
      <a href="https://app52.workline.hr/Candidate/Registration.aspx">Upload Your Profile</a>
      <p>Experienced professionals as well as freshers can apply</p>
    </main>
  </body>
</html>
`

const jobsBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>SMFG - Workline - Possibilities Infinite</title>
  </head>
  <body>
    <main>
      <h1>Begin your search for greater opportunities</h1>
      <button>Search Jobs</button>
      <button>Post Resume</button>
    </main>
    <script src="GeneralOpenings.js"></script>
  </body>
</html>
`

const listingRecords = [
  {
    Req_No: '9412',
    Position_Name: 'Area Sales Manager - Affordable Finance',
    LOCATIONNAME: 'Chennai',
    Experience: '6 to 10 years',
    PublishDate: '15-Jul-2026',
    TrackToken: '6f0c2253-2dc8-479e-a602-f706c327ab11',
    SearchKeyWord: 'Area-Sales-Manager---Affordable-Finance-Job-in-Chennai-9412',
    Field1: 'Affordable Finance',
    Field2: 'Chennai',
    FunName: 'Sales',
    State_Name: 'Tamil Nadu',
    Country_Name: 'India',
    GradeName: 'Manager',
    Business_Name: 'SMFG India Credit',
    No_Of_Vacancies: 2,
  },
  {
    Req_No: '9365',
    Position_Name: 'Branch Credit Manager',
    LOCATIONNAME: 'Pune',
    Experience: '4 to 8 years',
    PublishDate: '14-Jul-2026',
    TrackToken: '3837a565-93a7-47d9-a623-04f0eb7789c2',
    SearchKeyWord: 'Branch-Credit-Manager-Job-in-Pune-9365',
    Field1: 'Retail Lending',
    Field2: 'Pune',
    FunName: 'Credit',
    State_Name: 'Maharashtra',
    Country_Name: 'India',
    GradeName: 'Deputy Manager',
    Business_Name: 'SMFG India Credit',
    No_Of_Vacancies: 1,
  },
]

for(let index=0;index<listingRecords.length;index++)listingRecords[index]=withNativeDescription(listingRecords[index])
const jobsApiPayload = {
  d: {
    obj1: JSON.stringify(listingRecords),
    obj2: JSON.stringify([
      {
        Name: 'Location',
        Values: ['Chennai', 'Pune'],
      },
    ]),
  },
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/fullertonindia/script.js')
  } catch {
    assert.fail('Expected Fullerton India scraper module at ../../scraper/fullertonindia/script.js')
  }
}

test('Fullerton India helpers stay pinned to the verified redirect, careers handoff, Workline board, and listing payload contract from August 2, 2026', async () => {
  const fullertonIndia = await loadScriptModule()

  assert.equal(fullertonIndia.SOURCE, 'fullertonindia')
  assert.equal(fullertonIndia.COMPANY, 'Fullerton India')
  assert.equal(fullertonIndia.OFFICIAL_BRAND_NAME, 'SMFG India Credit')
  assert.equal(fullertonIndia.VERIFIED_AT, '2026-08-02')
  assert.equal(fullertonIndia.HOMEPAGE_URL, 'https://fullertonindia.com/')
  assert.equal(fullertonIndia.REDIRECTED_HOMEPAGE_URL, 'https://www.smfgindiacredit.com/')
  assert.equal(fullertonIndia.CAREERS_URL, 'https://www.smfgindiacredit.com/careers.aspx')
  assert.equal(
    fullertonIndia.JOBS_BOARD_ENTRY_URL,
    'https://app52.workline.hr/Candidate/GeneralOpening.aspx',
  )
  assert.equal(
    fullertonIndia.JOBS_BOARD_URL,
    'https://app52.workline.hr/Cportal/GeneralOpening.aspx',
  )
  assert.equal(
    fullertonIndia.JOBS_API_URL,
    'https://app52.workline.hr/CPortal/generalopening.aspx/GetCurrentopening',
  )
  assert.deepEqual(fullertonIndia.JOBS_API_BODY, {
    JDFileName: '',
    OrgCode: '',
    KeyName: '',
  })
  assert.equal(fullertonIndia.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(fullertonIndia.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    fullertonIndia.extractJobsBoardEntryUrl(careersHtml),
    fullertonIndia.JOBS_BOARD_ENTRY_URL,
  )
  assert.equal(fullertonIndia.hasOfficialJobsBoardSignal(jobsBoardHtml), true)
  assert.equal(fullertonIndia.hasVerifiedJobsPayloadContract(jobsApiPayload), true)
  assert.deepEqual(fullertonIndia.extractListingRecords(jobsApiPayload), listingRecords)
  assert.equal(
    fullertonIndia.buildDetailUrl(listingRecords[0]),
    'https://app52.workline.hr/CandidatePortal/6f0c2253-2dc8-479e-a602-f706c327ab11/Area-Sales-Manager---Affordable-Finance-Job-in-Chennai-9412',
  )
  assert.equal(
    fullertonIndia.buildApplyUrl(listingRecords[0]),
    'https://app52.workline.hr/Candidate/SignInv1.aspx?PRFCode=6f0c2253-2dc8-479e-a602-f706c327ab11&Flag=C&DirectApply=1',
  )
  assert.deepEqual(
    fullertonIndia.mapListingRecordToJob(listingRecords[0], {
      scrapedAt: '2026-07-15T10:30:00.000Z',
    }),
    {
      title: 'Area Sales Manager - Affordable Finance',
      company: 'Fullerton India',
      department: 'Sales',
      location: 'Chennai, Tamil Nadu, India',
      city: 'Chennai',
      country: 'India',
      sourceUrl:
        'https://app52.workline.hr/CandidatePortal/6f0c2253-2dc8-479e-a602-f706c327ab11/Area-Sales-Manager---Affordable-Finance-Job-in-Chennai-9412',
      applyUrl:
        'https://app52.workline.hr/Candidate/SignInv1.aspx?PRFCode=6f0c2253-2dc8-479e-a602-f706c327ab11&Flag=C&DirectApply=1',
      jobId: 'fullertonindia-9412',
      requisitionId: '9412',
      employmentType: null,
      workplaceType: null,
      experienceRequired: '6 to 10 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      compensation: null,
      postingDate: '2026-07-15',
      closingDate: null,
      jobDescription: [
        'Business: SMFG India Credit',
        'Line of business: Affordable Finance',
        'Function: Sales',
        'Location: Chennai',
        'Grade: Manager',
        'Open positions: 2',
        'Posted: 15-Jul-2026',
      ].join('\n'),
      source: 'fullertonindia',
      companyCareerPage: 'https://www.smfgindiacredit.com/careers.aspx',
      companyDomain: 'fullertonindia.com',
      atsPlatform: 'workline-public-jobs-api',
      link:
        'https://app52.workline.hr/Candidate/SignInv1.aspx?PRFCode=6f0c2253-2dc8-479e-a602-f706c327ab11&Flag=C&DirectApply=1',
      scrapedAt: '2026-07-15T10:30:00.000Z',
    },
  )
})

test('Fullerton India run validates the redirect, first-party careers handoff, Workline board, and jobs payload before returning normalized jobs', async () => {
  const fullertonIndia = await loadScriptModule()
  const pageRequests = []
  const jsonRequests = []

  const jobs = await fullertonIndia.createFullertonIndiaScraper({
    now: () => '2026-07-15T11:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      pageRequests.push(url)

      if (url === fullertonIndia.REDIRECTED_HOMEPAGE_URL) {
        return {
          status: 200,
          url: fullertonIndia.REDIRECTED_HOMEPAGE_URL,
          html: homepageHtml,
        }
      }

      if (url === fullertonIndia.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === fullertonIndia.JOBS_BOARD_ENTRY_URL) {
        return {
          status: 200,
          url: fullertonIndia.JOBS_BOARD_URL,
          html: jobsBoardHtml,
        }
      }

      const record=listingRecords.find(row=>fullertonIndia.buildDetailUrl(row)===url)
      if(record)return worklineDetailPage(record,url)
      throw new Error(`Unexpected Fullerton India URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      jsonRequests.push({
        url,
        method: options.method || 'GET',
        body: options.body ?? null,
      })

      if (url === fullertonIndia.JOBS_API_URL) {
        return jobsApiPayload
      }

      throw new Error(`Unexpected Fullerton India JSON URL: ${url}`)
    },
    fetchPDF:async()=>worklinePDF,
  })

  assert.deepEqual(pageRequests, [
    fullertonIndia.REDIRECTED_HOMEPAGE_URL,
    fullertonIndia.CAREERS_URL,
    fullertonIndia.JOBS_BOARD_ENTRY_URL,
    ...listingRecords.map(row=>fullertonIndia.buildDetailUrl(row)),
  ])
  assert.deepEqual(jsonRequests, [
    {
      url: fullertonIndia.JOBS_API_URL,
      method: 'POST',
      body: JSON.stringify({
        JDFileName: '',
        OrgCode: '',
        KeyName: '',
      }),
    },
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Area Sales Manager - Affordable Finance')
  assert.equal(jobs[0].company, 'Fullerton India')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-15T11:00:00.000Z')
  assert.equal(jobs[1].title, 'Branch Credit Manager')
  assert.equal(jobs[1].city, 'Pune')
  assert.equal(jobs[1].postingDate, '2026-07-14')
})

test('Fullerton India fails closed when the redirect, careers handoff, Workline board, or API contract drifts', async () => {
  const fullertonIndia = await loadScriptModule()

  await assert.rejects(
    fullertonIndia.createFullertonIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === fullertonIndia.REDIRECTED_HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body>Placeholder</body></html>' }
        }

        throw new Error(`Unexpected Fullerton India URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    fullertonIndia.createFullertonIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === fullertonIndia.REDIRECTED_HOMEPAGE_URL) {
          return {
            status: 200,
            url: fullertonIndia.REDIRECTED_HOMEPAGE_URL,
            html: homepageHtml,
          }
        }

        if (url === fullertonIndia.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersHtml.replace(
              'https://app52.workline.hr/Candidate/GeneralOpening.aspx',
              'https://careers.example.com/jobs',
            ),
          }
        }

        throw new Error(`Unexpected Fullerton India URL: ${url}`)
      },
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    fullertonIndia.createFullertonIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === fullertonIndia.REDIRECTED_HOMEPAGE_URL) {
          return {
            status: 200,
            url: fullertonIndia.REDIRECTED_HOMEPAGE_URL,
            html: homepageHtml,
          }
        }

        if (url === fullertonIndia.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === fullertonIndia.JOBS_BOARD_ENTRY_URL) {
          return {
            status: 200,
            url: fullertonIndia.JOBS_BOARD_URL,
            html: '<html><head><title>Workline</title></head><body>Login</body></html>',
          }
        }

        throw new Error(`Unexpected Fullerton India URL: ${url}`)
      },
    }),
    /verified jobs board/i,
  )

  await assert.rejects(
    fullertonIndia.createFullertonIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === fullertonIndia.REDIRECTED_HOMEPAGE_URL) {
          return {
            status: 200,
            url: fullertonIndia.REDIRECTED_HOMEPAGE_URL,
            html: homepageHtml,
          }
        }

        if (url === fullertonIndia.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === fullertonIndia.JOBS_BOARD_ENTRY_URL) {
          return {
            status: 200,
            url: fullertonIndia.JOBS_BOARD_URL,
            html: jobsBoardHtml,
          }
        }

        throw new Error(`Unexpected Fullerton India URL: ${url}`)
      },
      fetchJson: async () => ({ d: { obj1: '{}' } }),
    }),
    /verified jobs api/i,
  )
})
