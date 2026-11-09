import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>IndusInd Bank - Cards, Loans, Accounts, Personal & NRI Banking Online</title>
  </head>
  <body>
    <footer>
      <a href="https://app1100.workline.hr/careers/">Careers</a>
    </footer>
    <main>
      <h1>Digital banking made convenient</h1>
    </main>
  </body>
</html>
`

const careersLandingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>IndusInd Bank Careers</title>
  </head>
  <body>
    <header>
      <a href="https://www.indusind.bank.in/">Home</a>
    </header>
    <main>
      <h1>Become An IndusIndian</h1>
      <h2>Life at IndusInd Bank</h2>
      <p>Our culture revolves around innovation, creativity, teamwork, entrepreneurship, and compliance.</p>
      <a href="https://app1100.workline.hr/Cportal/GeneralOpening.aspx">Apply Now</a>
    </main>
  </body>
</html>
`

const jobsBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>IndusInd Bank - Workline - Possibilities Infinite</title>
  </head>
  <body>
    <div class="title-b clearfix">Begin your search for greater opportunities</div>
    <a class="btn career-apply" href="javascript:void(0);" onclick="AdvanceSearch();">Search Jobs</a>
    <div class="loadopenings"></div>
    <script src="GeneralOpenings.js?v=02092025"></script>
    <script>
      GeneralOpeningsDataLoad('', '', '','D','');
    </script>
  </body>
</html>
`

const listingRecords = [
  {
    Req_No: '87579',
    Position_Name: 'HR Analyst',
    PublishDate: '05-Jun-2026',
    JobSpecificationFile: '05422026104257222736_JD for Data Analyst- HR.docx',
    MRFDetailFile: '87579_2026Jul101032.pdf',
    SearchKeyWord: 'HR-Analyst-Job-in-One-World-Centre-9th-Floor-Office-86797',
    City_Name: 'Mumbai',
    State_Name: 'Maharashtra',
    ERF_Code: 86797,
    Company_Name: 'Shared Services/Wholesale Banking Group',
    FunName: 'Human Resources',
    LOCATIONNAME: 'One World Centre 9th Floor Office',
    Experience: '0 years',
    TimeDiff: 'Posted 1 month ago',
    Field1: 'Human Resources',
    Field2: 'Mumbai',
    TrackToken: '1f788ee8-158a-43ce-bab2-839248e14729',
  },
  {
    Req_No: '75972',
    Position_Name: 'Vigilance Officer',
    PublishDate: '27-Mar-2026',
    JobSpecificationFile: '27222026122239223423_Vigilance Associate JD June 2025.pdf',
    MRFDetailFile: '75972_2026Jul101035.pdf',
    SearchKeyWord: 'Vigilance-Officer-Job-in-Solitaire-Park-Office-74984',
    City_Name: 'Mumbai',
    State_Name: 'Maharashtra',
    ERF_Code: 74984,
    Company_Name: 'Shared Services/Wholesale Banking Group',
    FunName: 'Vigilance',
    LOCATIONNAME: 'Solitaire Park Office',
    Experience: '0 years',
    TimeDiff: 'Posted 4 months ago',
    Field1: 'Vigilance',
    Field2: 'Mumbai',
    TrackToken: '77d009a2-0f23-4b08-83a9-646d77ba584f',
  },
]

const jobsApiPayload = {
  d: {
    obj1: JSON.stringify(listingRecords),
    obj2: JSON.stringify([
      { OrgLabel: 'Department', OrgCode: 19, AsFieldName: 'FunName', datapriority: 1, DisplayOrder: 8 },
      { OrgLabel: 'State', OrgCode: 45, AsFieldName: 'State_Name', datapriority: 1, DisplayOrder: 31 },
      { OrgLabel: 'City', OrgCode: 53, AsFieldName: 'City_Name', datapriority: 1, DisplayOrder: 31 },
    ]),
  },
}

const buildDetailHtml = ({ title, reqNo, city, postedDate, companyName, trackToken }) => `
<!doctype html>
<html lang="en">
  <head>
    <title>${title}</title>
    <meta property="og:title" content="IndusInd Bank is hiring for ‘${title}’ Position">
  </head>
  <body>
    <header>
      <a href="/Candidate/Index.aspx">Home</a>
      <a href="/Cportal/GeneralOpening.aspx">Job Opportunities</a>
      <a href="/Candidate/SignInv1.aspx">Sign In</a>
    </header>
    <input type="hidden" name="PRFCode" id="PRFCode" value="${reqNo}" />
    <input type="hidden" name="Flag" id="Flag" value="C" />
    <div class="jobs-wrapper">
      <div class="jobs-content">
        <div class="jobs-content-left">
          <h6><span>${title}</span></h6>
          <div class="jobs-meta">
            <ul>
              <li><p><label class="label label-default part-time">${reqNo}</label></p></li>
              <li><p><i class="fa fa-sitemap" aria-hidden="true"></i> ${companyName} </p></li>
              <li><p><i class="fa fa-map-marker" aria-hidden="true"></i> ${city} </p></li>
              <li><p><i class="fa fa-clock-o" aria-hidden="true"></i> ${postedDate} </p></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    <div class="job-details-info">
      <li><span class="icon"><i class="fa fa-line-chart" aria-hidden="true"></i></span>Experience: 0 Years - 0 Months&nbsp;to&nbsp;0 Years - 0 Months</li>
    </div>
    <a href="https://web.whatsapp.com/send?text=IndusInd+Bank+is+Hiring!+Click+below+link+to+apply+for+the+job+https%3a%2f%2fapp1100.workline.hr%2fCandidatePortal%2f${trackToken}%2f${encodeURIComponent(title)}">Share</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/indusindbank/script.js')
  } catch {
    assert.fail('Expected IndusInd Bank scraper module at ../../scraper/indusindbank/script.js')
  }
}

test('IndusInd Bank pins the verified homepage careers handoff, Workline board shell, public jobs API contract, and public detail-route shape from July 16, 2026', async () => {
  const indusIndBank = await loadModule()

  assert.equal(indusIndBank.SOURCE, 'indusindbank')
  assert.equal(indusIndBank.COMPANY, 'IndusInd Bank')
  assert.equal(indusIndBank.OFFICIAL_BRAND_NAME, 'IndusInd Bank')
  assert.equal(indusIndBank.VERIFIED_AT, '2026-07-16')
  assert.equal(indusIndBank.HOMEPAGE_URL, 'https://www.indusind.bank.in/')
  assert.equal(indusIndBank.CAREERS_URL, 'https://app1100.workline.hr/careers/')
  assert.equal(indusIndBank.JOBS_BOARD_URL, 'https://app1100.workline.hr/Cportal/GeneralOpening.aspx')
  assert.equal(
    indusIndBank.JOBS_API_URL,
    'https://app1100.workline.hr/rec/TAServices.asmx/GetCurrentopening',
  )
  assert.deepEqual(indusIndBank.JOBS_API_BODY, {
    JDFileName: '',
    OrgCode: '',
    KeyName: '',
    Type: 'D',
    StateCode: '',
  })
  assert.equal(indusIndBank.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(indusIndBank.extractCareersHandoffUrl(homepageHtml), indusIndBank.CAREERS_URL)
  assert.equal(indusIndBank.hasOfficialCareersLandingSignal(careersLandingHtml), true)
  assert.equal(indusIndBank.extractJobsBoardUrl(careersLandingHtml), indusIndBank.JOBS_BOARD_URL)
  assert.equal(indusIndBank.hasOfficialJobsBoardSignal(jobsBoardHtml), true)
  assert.equal(indusIndBank.hasVerifiedJobsPayloadContract(jobsApiPayload), true)
  assert.deepEqual(indusIndBank.extractListingRecords(jobsApiPayload), listingRecords)
  assert.equal(
    indusIndBank.buildDetailUrl(listingRecords[0]),
    'https://app1100.workline.hr/CandidatePortal/1f788ee8-158a-43ce-bab2-839248e14729/HR-Analyst-Job-in-One-World-Centre-9th-Floor-Office-86797',
  )
  assert.equal(
    indusIndBank.hasOfficialDetailPageSignal(
      buildDetailHtml({
        title: listingRecords[0].Position_Name,
        reqNo: listingRecords[0].Req_No,
        city: listingRecords[0].Field2,
        postedDate: listingRecords[0].PublishDate,
        companyName: listingRecords[0].Company_Name,
        trackToken: listingRecords[0].TrackToken,
      }),
      listingRecords[0],
    ),
    true,
  )
  assert.deepEqual(
    indusIndBank.mapListingRecordToJob(listingRecords[0], {
      scrapedAt: '2026-07-16T11:00:00.000Z',
    }),
    {
      title: 'HR Analyst',
      company: 'IndusInd Bank',
      department: 'Human Resources',
      location: 'Mumbai, Maharashtra, India',
      city: 'Mumbai',
      country: 'India',
      sourceUrl:
        'https://app1100.workline.hr/CandidatePortal/1f788ee8-158a-43ce-bab2-839248e14729/HR-Analyst-Job-in-One-World-Centre-9th-Floor-Office-86797',
      applyUrl:
        'https://app1100.workline.hr/CandidatePortal/1f788ee8-158a-43ce-bab2-839248e14729/HR-Analyst-Job-in-One-World-Centre-9th-Floor-Office-86797',
      jobId: 'indusindbank-87579',
      requisitionId: '87579',
      employmentType: null,
      workplaceType: null,
      experienceRequired: '0 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      compensation: null,
      postingDate: '2026-06-05',
      closingDate: null,
      jobDescription: [
        'Business unit: Shared Services/Wholesale Banking Group',
        'Function: Human Resources',
        'Department label: Human Resources',
        'Location: One World Centre 9th Floor Office',
        'City: Mumbai',
        'State: Maharashtra',
        'Experience: 0 years',
        'Posted: 05-Jun-2026',
      ].join('\n'),
      source: 'indusindbank',
      companyCareerPage: 'https://app1100.workline.hr/careers/',
      companyDomain: 'indusind.bank.in',
      atsPlatform: 'workline-public-jobs-api',
      link:
        'https://app1100.workline.hr/CandidatePortal/1f788ee8-158a-43ce-bab2-839248e14729/HR-Analyst-Job-in-One-World-Centre-9th-Floor-Office-86797',
      scrapedAt: '2026-07-16T11:00:00.000Z',
    },
  )
})

test('IndusInd Bank run validates the homepage handoff, Workline board shell, public API, and detail pages before returning normalized jobs', async () => {
  const indusIndBank = await loadModule()
  const pageRequests = []
  const jsonRequests = []

  const jobs = await indusIndBank.createIndusIndBankScraper({
    now: () => '2026-07-16T11:30:00.000Z',
  }).run({
    fetchPage: async (url) => {
      pageRequests.push(url)

      if (url === indusIndBank.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === indusIndBank.CAREERS_URL) {
        return { status: 200, url, html: careersLandingHtml }
      }

      if (url === indusIndBank.JOBS_BOARD_URL) {
        return { status: 200, url, html: jobsBoardHtml, cookieHeader: 'sess_map=test-cookie; __Secure-SID=test-sid' }
      }

      if (url === indusIndBank.buildDetailUrl(listingRecords[0])) {
        return {
          status: 200,
          url,
          html: buildDetailHtml({
            title: listingRecords[0].Position_Name,
            reqNo: listingRecords[0].Req_No,
            city: listingRecords[0].Field2,
            postedDate: listingRecords[0].PublishDate,
            companyName: listingRecords[0].Company_Name,
            trackToken: listingRecords[0].TrackToken,
          }),
        }
      }

      if (url === indusIndBank.buildDetailUrl(listingRecords[1])) {
        return {
          status: 200,
          url,
          html: buildDetailHtml({
            title: listingRecords[1].Position_Name,
            reqNo: listingRecords[1].Req_No,
            city: listingRecords[1].Field2,
            postedDate: listingRecords[1].PublishDate,
            companyName: listingRecords[1].Company_Name,
            trackToken: listingRecords[1].TrackToken,
          }),
        }
      }

      throw new Error(`Unexpected IndusInd Bank URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      jsonRequests.push({
        url,
        method: options.method || 'GET',
        body: options.body ?? null,
        cookie: options.headers?.cookie ?? null,
      })

      if (url === indusIndBank.JOBS_API_URL) {
        return jobsApiPayload
      }

      throw new Error(`Unexpected IndusInd Bank JSON URL: ${url}`)
    },
  })

  assert.deepEqual(pageRequests, [
    indusIndBank.HOMEPAGE_URL,
    indusIndBank.CAREERS_URL,
    indusIndBank.JOBS_BOARD_URL,
    indusIndBank.buildDetailUrl(listingRecords[0]),
    indusIndBank.buildDetailUrl(listingRecords[1]),
  ])
  assert.deepEqual(jsonRequests, [
    {
      url: indusIndBank.JOBS_API_URL,
      method: 'POST',
      body: JSON.stringify({
        JDFileName: '',
        OrgCode: '',
        KeyName: '',
        Type: 'D',
        StateCode: '',
      }),
      cookie: 'sess_map=test-cookie; __Secure-SID=test-sid',
    },
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'HR Analyst')
  assert.equal(jobs[0].city, 'Mumbai')
  assert.equal(jobs[0].applyUrl, jobs[0].sourceUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-16T11:30:00.000Z')
  assert.equal(jobs[1].title, 'Vigilance Officer')
  assert.equal(jobs[1].requisitionId, '75972')
})

test('IndusInd Bank fails closed when the homepage handoff, Workline board shell, public API contract, or detail pages drift', async () => {
  const indusIndBank = await loadModule()

  await assert.rejects(
    indusIndBank.createIndusIndBankScraper().run({
      fetchPage: async () => ({ status: 200, url: indusIndBank.HOMEPAGE_URL, html: '<html><body>No careers link</body></html>' }),
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    indusIndBank.createIndusIndBankScraper().run({
      fetchPage: async (url) => {
        if (url === indusIndBank.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === indusIndBank.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersLandingHtml.replace(
              'https://app1100.workline.hr/Cportal/GeneralOpening.aspx',
              'https://careers.example.com/jobs',
            ),
          }
        }

        throw new Error(`Unexpected IndusInd Bank URL: ${url}`)
      },
    }),
    /verified careers landing/i,
  )

  await assert.rejects(
    indusIndBank.createIndusIndBankScraper().run({
      fetchPage: async (url) => {
        if (url === indusIndBank.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === indusIndBank.CAREERS_URL) {
          return { status: 200, url, html: careersLandingHtml }
        }

        if (url === indusIndBank.JOBS_BOARD_URL) {
          return { status: 200, url, html: '<html><body>Search</body></html>' }
        }

        throw new Error(`Unexpected IndusInd Bank URL: ${url}`)
      },
    }),
    /verified jobs board/i,
  )

  await assert.rejects(
    indusIndBank.createIndusIndBankScraper().run({
      fetchPage: async (url) => {
        if (url === indusIndBank.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === indusIndBank.CAREERS_URL) {
          return { status: 200, url, html: careersLandingHtml }
        }

        if (url === indusIndBank.JOBS_BOARD_URL) {
          return { status: 200, url, html: jobsBoardHtml, cookieHeader: 'sess_map=test-cookie' }
        }

        throw new Error(`Unexpected IndusInd Bank URL: ${url}`)
      },
      fetchJson: async () => ({ d: { obj1: '{}' } }),
    }),
    /verified jobs api/i,
  )

  await assert.rejects(
    indusIndBank.createIndusIndBankScraper().run({
      fetchPage: async (url) => {
        if (url === indusIndBank.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === indusIndBank.CAREERS_URL) {
          return { status: 200, url, html: careersLandingHtml }
        }

        if (url === indusIndBank.JOBS_BOARD_URL) {
          return { status: 200, url, html: jobsBoardHtml, cookieHeader: 'sess_map=test-cookie' }
        }

        if (url === indusIndBank.buildDetailUrl(listingRecords[0])) {
          return { status: 200, url, html: '<html><head><title>Broken detail</title></head><body>Broken detail</body></html>' }
        }

        if (url === indusIndBank.buildDetailUrl(listingRecords[1])) {
          return {
            status: 200,
            url,
            html: buildDetailHtml({
              title: listingRecords[1].Position_Name,
              reqNo: listingRecords[1].Req_No,
              city: listingRecords[1].Field2,
              postedDate: listingRecords[1].PublishDate,
              companyName: listingRecords[1].Company_Name,
              trackToken: listingRecords[1].TrackToken,
            }),
          }
        }

        throw new Error(`Unexpected IndusInd Bank URL: ${url}`)
      },
      fetchJson: async () => jobsApiPayload,
    }),
    /verified detail page/i,
  )
})
