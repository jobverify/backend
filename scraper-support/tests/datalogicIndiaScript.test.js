import assert from 'node:assert/strict'
import test from 'node:test'

const loadDatalogicIndiaModule = async () => {
  try {
    return await import('../../scraper/datalogicindia/script.js')
  } catch {
    assert.fail('Expected Datalogic India scraper module at ../../scraper/datalogicindia/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Datalogic</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>Thank you for your interest in a career with Datalogic!</p>
      <p>
        You can submit your resume electronically using the portal on this page by clicking on
        the SEE ALL OPEN jobs button.
      </p>
      <a href="https://career2.successfactors.eu/career?company=datalogics">SEE ALL OPEN JOBS</a>
    </main>
  </body>
</html>
`

const searchHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Opportunities</title>
  </head>
  <body>
    <div id="careerJobSearchContainer">
      <h2>Search for Openings</h2>
      <div>63 Jobs matched your search</div>
      <div>Page 1 of 7</div>
      <div>Items per page 10</div>
      <table>
        <tbody>
          <tr class="jobResultItem">
            <td>
              <div role="heading" aria-level="3">
                <a
                  class="jobTitle"
                  href="https://career2.successfactors.eu/career?career_ns=job_listing&company=datalogics&navBarLevel=JOB_SEARCH&rcm_site_locale=en_US&career_job_req_id=11306&selected_lang=en_US&jobAlertController_jobAlertId=&jobAlertController_jobAlertName=&browserTimeZone=Asia/Calcutta&_s.crb=abc123"
                >
                  Embedded Software Engineer (R&D93)
                </a>
              </div>
              <div class="noteSection" role="note">
                <div>
                  Requisition ID <span class="jobContentEM">11306</span> -
                  <span class="jobContentEM">Posted on 07/13/2026</span> -
                  <span class="jobContentEM">Calderara Di Reno</span> -
                  <span class="jobContentEM">Italy</span> -
                  <span class="jobContentEM">N/A</span>
                </div>
              </div>
            </td>
          </tr>
          <tr class="jobResultItem">
            <td>
              <div role="heading" aria-level="3">
                <a
                  class="jobTitle"
                  href="https://career2.successfactors.eu/career?career_ns=job_listing&company=datalogics&navBarLevel=JOB_SEARCH&rcm_site_locale=en_US&career_job_req_id=11363&selected_lang=en_US&jobAlertController_jobAlertId=&jobAlertController_jobAlertName=&browserTimeZone=Asia/Calcutta&_s.crb=abc123"
                >
                  India Finance Manager
                </a>
              </div>
              <div class="noteSection" role="note">
                <div>
                  Requisition ID <span class="jobContentEM">11363</span> -
                  <span class="jobContentEM">Posted on 03/11/2026</span> -
                  <span class="jobContentEM">Gurgaon</span> -
                  <span class="jobContentEM">India</span> -
                  <span class="jobContentEM">N/A</span>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </body>
</html>
`

const dwrBootstrapHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Opportunities</title>
  </head>
  <body>
    <h1 id="candidateProfileTitle">Career Opportunities</h1>
    <input id="career_ns" value="job_listing_summary" />
    <input id="company" value="datalogics" />
    <input type="hidden" name="ajaxSecKey" value="csrf-token" />
    <div id="careerJobSearchContainer"></div>
    <script>
      window.addEventListener("load", getInitialJobSearchData);
      careerJobSearchController.getInitialJobSearchData("", "", "", "Asia/Calcutta");
      var ajaxSecKey="csrf-token";
    </script>
  </body>
</html>
`

const buildDwrSummaryResponse = ({
  currentPage = 1,
  pageSize = 10,
  totalCount,
  postings,
  wrapInPayload = true,
}) => {
  const normalizedPostings = postings.map((posting) => ({
    id: Number(posting.requisitionId),
    title: posting.title,
    postingDate: posting.postingDate,
    otherValues: [[
      { fieldId: 'location_obj', shortVal: `["Location",1,"${posting.city}"]` },
      { fieldId: 'filter1', shortVal: posting.country },
      { fieldId: 'filter2', shortVal: posting.state || 'N/A' },
    ]],
  }))

  const payload = {
    results: {
      postingCount: totalCount ?? normalizedPostings.length,
      options: {
        pagination: {
          currentPage,
          pageSize,
          totalCount: totalCount ?? normalizedPostings.length,
          startRow: ((currentPage - 1) * pageSize) + 1,
          endRow: Math.min(currentPage * pageSize, totalCount ?? normalizedPostings.length),
          increaseCandSummaryPagination: false,
        },
        sortByColumn: 'JOB_POSTING_DATE',
        sortOrder: 'DESC',
      },
      postings: normalizedPostings,
    },
  }

  const callbackValue = wrapInPayload ? { payload } : payload

  return `
throw 'allowScriptTagRemoting is false.';
dwr.engine._remoteHandleCallback('0', '0', ${JSON.stringify(callbackValue)});
`
}

const detailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Opportunities: India Finance Manager (11363)</title>
  </head>
  <body>
    <main>
      <h1>Career Opportunities: India Finance Manager (11363)</h1>
      <p>Requisition ID 11363 - Posted 03/11/2026 - Gurgaon - India - N/A</p>
      <button
        id="applyButton_top"
        onclick="checkDpcs2AndProceed({isUserLoggedIn: false , jobReqId: 11363, jobSecKey: '1768457442774060312665806520149704367233823807297305231136842136058195093198573572174543065142042100450621', isApplyWithLinkedIn:false, elementId: 'applyButton_top', evtSrc:'Apply'}); return false;"
      >
        Apply
      </button>
      <input
        type="hidden"
        id="career_job_req_sec_key"
        name="career_job_req_sec_key"
        value="4A575879354A52703844466F6C687A524B65385041304B6A5367767A65346C4C6C5338396863512F6857593D"
      />
      <h2>Job Description</h2>
      <p>
        This position will be a key member of the Group Finance Team of our multinational technology company.
      </p>
      <h2>Role Mission</h2>
      <p>
        The role will act as the primary finance leader for the newly established Indian legal entity and will own
        end-to-end financial management activities.
      </p>
      <h2>Key Responsibilities</h2>
      <ul>
        <li>Define and enforce customer credit policies, credit limits, and payment terms across India business units.</li>
        <li>Lead or actively support the setup of the new legal entity in India.</li>
      </ul>
      <h2>Requirements</h2>
      <ul>
        <li>Education: Chartered Accountant (ACA/FCA) or MBA.</li>
        <li>Experience: At least 6-7 years of post-qualification experience.</li>
      </ul>
    </main>
  </body>
</html>
`

const tagSplitSearchHtml = searchHtml
  .replace('63 Jobs matched your search', '63 <span>Jobs matched your search</span>')
  .replace('Page 1 of 7', 'Page <span>1</span> of <span>7</span>')
  .replace('Items per page 10', 'Items per page <span>10</span>')

test('Datalogic India helpers stay pinned to the verified first-party careers handoff and official SuccessFactors detail-url contract', async () => {
  const datalogicIndia = await loadDatalogicIndiaModule()

  assert.equal(datalogicIndia.SOURCE, 'datalogicindia')
  assert.equal(datalogicIndia.COMPANY_NAME, 'Datalogic India')
  assert.equal(datalogicIndia.HOMEPAGE_URL, 'https://www.datalogic.com/')
  assert.equal(datalogicIndia.CAREERS_PAGE_URL, 'https://www.datalogic.com/eng/company/careers-ca-26.html')
  assert.equal(datalogicIndia.SUCCESSFACTORS_BOARD_URL, 'https://career2.successfactors.eu/career?company=datalogics')
  assert.equal(
    datalogicIndia.SUCCESSFACTORS_SEARCH_URL,
    'https://career2.successfactors.eu/career?company=datalogics&career_ns=job_listing_summary&navBarLevel=JOB_SEARCH&',
  )
  assert.equal(
    datalogicIndia.buildDetailUrl('11363'),
    'https://career2.successfactors.eu/career?career_ns=job_listing&company=datalogics&navBarLevel=JOB_SEARCH&rcm_site_locale=en_US&career_job_req_id=11363&selected_lang=en_US&jobAlertController_jobAlertId=&jobAlertController_jobAlertName=&browserTimeZone=Asia/Calcutta',
  )
  assert.equal(
    datalogicIndia.normalizeSuccessFactorsUrl('https://career2.successfactors.eu/career?career_ns=job_listing&company=datalogics&navBarLevel=JOB_SEARCH&rcm_site_locale=en_US&career_job_req_id=11363&selected_lang=en_US&jobAlertController_jobAlertId=&jobAlertController_jobAlertName=&browserTimeZone=Asia/Calcutta&_s.crb=abc123'),
    datalogicIndia.buildDetailUrl('11363'),
  )
  assert.equal(
    datalogicIndia.normalizeSuccessFactorsUrl('https://career2.successfactors.eu/career?career_ns=job_listing&amp;company=datalogics&amp;career_job_req_id=11363'),
    'https://career2.successfactors.eu/career?career_ns=job_listing&company=datalogics&career_job_req_id=11363',
  )
  assert.equal(datalogicIndia.extractSuccessFactorsHandoffUrl(careersHtml), datalogicIndia.SUCCESSFACTORS_BOARD_URL)
  assert.equal(datalogicIndia.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(datalogicIndia.hasSuccessFactorsSearchPageSignal(searchHtml), true)
  assert.equal(datalogicIndia.hasSuccessFactorsSearchPageSignal(tagSplitSearchHtml), true)
  assert.deepEqual(datalogicIndia.extractSearchSummary(searchHtml), {
    totalJobs: 63,
    currentPage: 1,
    totalPages: 7,
    pageSize: 10,
  })
  assert.deepEqual(datalogicIndia.extractSearchSummary(tagSplitSearchHtml), {
    totalJobs: 63,
    currentPage: 1,
    totalPages: 7,
    pageSize: 10,
  })

  assert.deepEqual(datalogicIndia.extractSearchResults(searchHtml), [
    {
      title: 'Embedded Software Engineer (R&D93)',
      location: 'Calderara Di Reno, Italy',
      city: 'Calderara Di Reno',
      state: null,
      country: 'Italy',
      jobId: '11306',
      requisitionId: '11306',
      sourceUrl: datalogicIndia.buildDetailUrl('11306'),
      applyUrl: datalogicIndia.buildDetailUrl('11306'),
      postingDate: '2026-07-13',
    },
    {
      title: 'India Finance Manager',
      location: 'Gurgaon, India',
      city: 'Gurgaon',
      state: null,
      country: 'India',
      jobId: '11363',
      requisitionId: '11363',
      sourceUrl: datalogicIndia.buildDetailUrl('11363'),
      applyUrl: datalogicIndia.buildDetailUrl('11363'),
      postingDate: '2026-03-11',
    },
  ])
})

test('Datalogic India extracts verified SuccessFactors DWR results for the India board', async () => {
  const datalogicIndia = await loadDatalogicIndiaModule()

  const jobs = [...datalogicIndia.extractSearchResults(
    buildDwrSummaryResponse({
      currentPage: 2,
      totalCount: 63,
      postings: [
        {
          requisitionId: '11306',
          title: 'Embedded Software Engineer (R&D93)',
          postingDate: '08/13/2026',
          city: 'Trnava',
          country: 'Slovakia',
        },
        {
          requisitionId: '11363',
          title: 'India Finance Manager',
          postingDate: '03/11/2026',
          city: 'Gurgaon',
          country: 'India',
        },
      ],
      wrapInPayload: false,
    }),
  )].map((job) => ({ ...job }))

  assert.deepEqual(jobs, [
    {
      title: 'Embedded Software Engineer (R&D93)',
      location: 'Trnava, Slovakia',
      city: 'Trnava',
      state: null,
      country: 'Slovakia',
      jobId: '11306',
      requisitionId: '11306',
      sourceUrl: datalogicIndia.buildDetailUrl('11306'),
      applyUrl: datalogicIndia.buildDetailUrl('11306'),
      postingDate: '2026-08-13',
    },
    {
      title: 'India Finance Manager',
      location: 'Gurgaon, India',
      city: 'Gurgaon',
      state: null,
      country: 'India',
      jobId: '11363',
      requisitionId: '11363',
      sourceUrl: datalogicIndia.buildDetailUrl('11363'),
      applyUrl: datalogicIndia.buildDetailUrl('11363'),
      postingDate: '2026-03-11',
    },
  ])
})

test('extractJobDetail keeps the live India requisition pinned to the canonical public detail page and description sections', async () => {
  const datalogicIndia = await loadDatalogicIndiaModule()
  const detail = datalogicIndia.extractJobDetail(detailHtml, {
    title: 'India Finance Manager',
    location: 'Gurgaon, India',
    city: 'Gurgaon',
    state: null,
    country: 'India',
    jobId: '11363',
    requisitionId: '11363',
    sourceUrl: datalogicIndia.buildDetailUrl('11363'),
    applyUrl: datalogicIndia.buildDetailUrl('11363'),
    postingDate: '2026-03-11',
  })

  assert.deepEqual(detail, {
    title: 'India Finance Manager',
    location: 'Gurgaon, India',
    city: 'Gurgaon',
    state: null,
    country: 'India',
    jobId: '11363',
    requisitionId: '11363',
    employmentType: null,
    experienceRequired: null,
    jobDescription: 'Job Description: This position will be a key member of the Group Finance Team of our multinational technology company.\n\nRole Mission: The role will act as the primary finance leader for the newly established Indian legal entity and will own end-to-end financial management activities.\n\nKey Responsibilities: Define and enforce customer credit policies, credit limits, and payment terms across India business units. Lead or actively support the setup of the new legal entity in India.\n\nRequirements: Education: Chartered Accountant (ACA/FCA) or MBA. Experience: At least 6-7 years of post-qualification experience.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Define and enforce customer credit policies, credit limits, and payment terms across India business units.',
      'Lead or actively support the setup of the new legal entity in India.',
      'Education: Chartered Accountant (ACA/FCA) or MBA.',
      'Experience: At least 6-7 years of post-qualification experience.',
    ],
    postingDate: '2026-03-11',
    applyUrl: datalogicIndia.buildDetailUrl('11363'),
    sourceUrl: datalogicIndia.buildDetailUrl('11363'),
    publicExperienceChecked: true,
  })
})

test('Datalogic India run keeps the scraper on the verified careers handoff, public board, and India detail page only', async () => {
  const datalogicIndia = await loadDatalogicIndiaModule()
  const requestedUrls = []

  const jobs = await datalogicIndia.createDatalogicIndiaScraper({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === datalogicIndia.CAREERS_PAGE_URL) return careersHtml
      if (url === datalogicIndia.buildDetailUrl('11363')) return detailHtml
      throw new Error(`Unexpected Datalogic India URL: ${url}`)
    },
    getSearchPages: async () => [searchHtml],
    now: () => '2026-07-15T00:00:00.000Z',
  }).run()

  assert.deepEqual(requestedUrls, [
    'https://www.datalogic.com/eng/company/careers-ca-26.html',
    'https://career2.successfactors.eu/career?career_ns=job_listing&company=datalogics&navBarLevel=JOB_SEARCH&rcm_site_locale=en_US&career_job_req_id=11363&selected_lang=en_US&jobAlertController_jobAlertId=&jobAlertController_jobAlertName=&browserTimeZone=Asia/Calcutta',
  ])

  assert.deepEqual(jobs, [{
    title: 'India Finance Manager',
    company: 'Datalogic India',
    location: 'Gurgaon, India',
    city: 'Gurgaon',
    state: null,
    country: 'India',
    link: datalogicIndia.buildDetailUrl('11363'),
    applyUrl: datalogicIndia.buildDetailUrl('11363'),
    sourceUrl: datalogicIndia.buildDetailUrl('11363'),
    source: 'datalogicindia',
    jobId: '11363',
    requisitionId: '11363',
    department: null,
    employmentType: null,
    experienceRequired: null,
    jobDescription: 'Job Description: This position will be a key member of the Group Finance Team of our multinational technology company.\n\nRole Mission: The role will act as the primary finance leader for the newly established Indian legal entity and will own end-to-end financial management activities.\n\nKey Responsibilities: Define and enforce customer credit policies, credit limits, and payment terms across India business units. Lead or actively support the setup of the new legal entity in India.\n\nRequirements: Education: Chartered Accountant (ACA/FCA) or MBA. Experience: At least 6-7 years of post-qualification experience.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Define and enforce customer credit policies, credit limits, and payment terms across India business units.',
      'Lead or actively support the setup of the new legal entity in India.',
      'Education: Chartered Accountant (ACA/FCA) or MBA.',
      'Experience: At least 6-7 years of post-qualification experience.',
    ],
    postingDate: '2026-03-11',
    scrapedAt: '2026-07-15T00:00:00.000Z',
    publicExperienceChecked: true,
  }])
})

test('Datalogic India fails closed when the verified careers handoff or public search surface drifts', async () => {
  const datalogicIndia = await loadDatalogicIndiaModule()

  await assert.rejects(
    datalogicIndia.createDatalogicIndiaScraper({
      fetchText: async () => careersHtml.replace(
        'https://career2.successfactors.eu/career?company=datalogics',
        'https://boards.greenhouse.io/datalogic/jobs/11363',
      ),
      getSearchPages: async () => [searchHtml],
    }).run(),
    /verified official datalogic careers page/i,
  )

  await assert.rejects(
    datalogicIndia.createDatalogicIndiaScraper({
      fetchText: async (url) => {
        if (url === datalogicIndia.CAREERS_PAGE_URL) return careersHtml
        throw new Error(`Unexpected Datalogic India URL: ${url}`)
      },
      getSearchPages: async () => ['<html><body><h1>Career Opportunities</h1></body></html>'],
    }).run(),
    /verified public successfactors search surface/i,
  )
})

test('Datalogic India follows the verified public SuccessFactors DWR bootstrap contract', async () => {
  const datalogicIndia = await loadDatalogicIndiaModule()

  const pages = await datalogicIndia.getLiveSearchPages({
    fetchText: async () => dwrBootstrapHtml,
    fetchSearchSession: async () => ({
      html: dwrBootstrapHtml,
      csrfToken: 'csrf-token',
      cookieHeader: 'JSESSIONID=abc123',
    }),
    fetchDwrText: async ({ endpoint }) => {
      assert.equal(endpoint, 'getInitialJobSearchData')

      return buildDwrSummaryResponse({
        postings: [
          {
            requisitionId: '11363',
            title: 'India Finance Manager',
            postingDate: '03/11/2026',
            city: 'Gurgaon',
            country: 'India',
          },
        ],
      })
    },
  })

  assert.equal(pages.length, 1)
  assert.deepEqual([...datalogicIndia.extractSearchResults(pages[0])].map((job) => ({ ...job })), [
    {
      title: 'India Finance Manager',
      location: 'Gurgaon, India',
      city: 'Gurgaon',
      state: null,
      country: 'India',
      jobId: '11363',
      requisitionId: '11363',
      sourceUrl: datalogicIndia.buildDetailUrl('11363'),
      applyUrl: datalogicIndia.buildDetailUrl('11363'),
      postingDate: '2026-03-11',
    },
  ])
})
