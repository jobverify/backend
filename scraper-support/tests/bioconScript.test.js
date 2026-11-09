import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
<!doctype html>
<html>
  <head>
    <title>Careers at Biocon - Put your passion for science into practice</title>
  </head>
  <body>
    <main>
      <h1>Careers at Biocon</h1>
      <p>It's a chance at Biocon to work alongside some of the brightest minds in research, healthcare, pharmaceutical, biotechnology &amp; business sector.</p>
      <a href="https://career10.successfactors.com/career?company=bioconlimi">Now Hiring</a>
    </main>
  </body>
</html>
`

const summaryPageOneHtml = `
<!doctype html>
<html>
  <head>
    <title>Career Opportunities</title>
  </head>
  <body>
    <div>51 Jobs match the selections</div>
    <div>Search Results</div>
    <table>
      <tbody>
        <tr class="jobResultItem">
          <td>
            <div role="heading" aria-level="3">
              <a
                class="jobTitle"
                href="/career?career%5fns=job%5flisting&company=bioconlimi&navBarLevel=JOB%5fSEARCH&rcm%5fsite%5flocale=en%5fUS&career_job_req_id=20811&selected_lang=en_US&jobAlertController_jobAlertId=&jobAlertController_jobAlertName=&browserTimeZone=Asia/Calcutta"
              >
                MANAGER
              </a>
            </div>
            <div class="noteSection" role="note">
              <span class="jobContentEM">20811</span>
              <span class="jobContentEM">Posted on 07/14/2026</span>
              <span class="jobContentEM">BIOCON LIMITED</span>
              <span class="jobContentEM">API MAINTENANCE</span>
              <span class="jobContentEM">India</span>
            </div>
          </td>
        </tr>
        <tr class="jobResultItem">
          <td>
            <div role="heading" aria-level="3">
              <a
                class="jobTitle"
                href="/career?career%5fns=job%5flisting&company=bioconlimi&navBarLevel=JOB%5fSEARCH&rcm%5fsite%5flocale=en%5fUS&career_job_req_id=20830&selected_lang=en_US&jobAlertController_jobAlertId=&jobAlertController_jobAlertName=&browserTimeZone=Asia/Calcutta"
              >
                SENIOR EXECUTIVE
              </a>
            </div>
            <div class="noteSection" role="note">
              <span class="jobContentEM">20830</span>
              <span class="jobContentEM">Posted on 07/14/2026</span>
              <span class="jobContentEM">BIOCON BIOSPHERE LIMITED</span>
              <span class="jobContentEM">SMV VIZ BBSL PRODUCTION US MEDIA &amp; FERM</span>
              <span class="jobContentEM">India</span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <a title="Next Page" href="javascript:void(0)">Next</a>
  </body>
</html>
`

const summaryPageTwoHtml = `
<!doctype html>
<html>
  <head>
    <title>Career Opportunities</title>
  </head>
  <body>
    <div>51 Jobs match the selections</div>
    <div>Search Results</div>
    <table>
      <tbody>
        <tr class="jobResultItem">
          <td>
            <div role="heading" aria-level="3">
              <a
                class="jobTitle"
                href="/career?career%5fns=job%5flisting&company=bioconlimi&navBarLevel=JOB%5fSEARCH&rcm%5fsite%5flocale=en%5fUS&career_job_req_id=20820&selected_lang=en_US&jobAlertController_jobAlertId=&jobAlertController_jobAlertName=&browserTimeZone=Asia/Calcutta"
              >
                EXECUTIVE
              </a>
            </div>
            <div class="noteSection" role="note">
              <span class="jobContentEM">20820</span>
              <span class="jobContentEM">Posted on 07/14/2026</span>
              <span class="jobContentEM">BIOCON BIOSPHERE LIMITED</span>
              <span class="jobContentEM">SMV VIZ BBSL PRODUCTION US MEDIA &amp; FERM</span>
              <span class="jobContentEM">India</span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
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
    otherValues: [
      [
        { fieldId: 'legalEntity_obj', shortVal: posting.hiringEntity },
        { fieldId: 'department_obj', shortVal: posting.department },
        { fieldId: 'filter1', shortVal: posting.country || 'India' },
      ],
      [
        { fieldId: 'filter3', shortVal: '' },
        { fieldId: 'filter4', shortVal: '' },
      ],
    ],
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

const buildDetailHtml = ({
  requisitionId,
  title,
  postingDate,
  hiringEntity,
  department,
  location,
  roleSummary,
  responsibilities,
}) => `
<!doctype html>
<html>
  <head>
    <title>Career Opportunities: ${title} (${requisitionId})</title>
  </head>
  <body>
    <h1 id="candidateProfileTitle">Career Opportunities: ${title} (${requisitionId})</h1>
    <div>
      Requisition ID ${requisitionId} - Posted ${postingDate} - ${hiringEntity} - ${department} - India
    </div>
    <div style="padding:10px 0;border:1px solid transparent">
      <div style="font-size:16px;word-wrap:break-word"><h2 style="font-size:1em;margin:0">Job Location: ${location}</h2></div>
      <div></div>
    </div>
    <div style="padding:10px 0;border:1px solid transparent">
      <div style="font-size:16px;word-wrap:break-word"><h2 style="font-size:1em;margin:0">Department Details</h2></div>
      <div><p>${department}</p></div>
    </div>
    <div style="padding:10px 0;border:1px solid transparent">
      <div style="font-size:16px;word-wrap:break-word"><h2 style="font-size:1em;margin:0">Role Summary</h2></div>
      <div><p>${roleSummary}</p></div>
    </div>
    <div style="padding:10px 0;border:1px solid transparent">
      <div style="font-size:16px;word-wrap:break-word"><h2 style="font-size:1em;margin:0">Key Responsibilities</h2></div>
      <div><ul><li>${responsibilities}</li></ul></div>
    </div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/biocon/script.js')
  } catch {
    assert.fail('Expected Biocon scraper module at ../../scraper/biocon/script.js')
  }
}

test('Biocon scraper exports the verified first-party careers and public SuccessFactors contract', async () => {
  const biocon = await loadModule()

  assert.equal(biocon.COMPANY_NAME, 'Biocon')
  assert.equal(biocon.HOMEPAGE_URL, 'https://www.biocon.com/')
  assert.equal(biocon.CAREERS_PAGE_URL, 'https://www.biocon.com/careers/')
  assert.equal(biocon.SUCCESSFACTORS_BOARD_URL, 'https://career10.successfactors.com/career?company=bioconlimi')
  assert.equal(
    biocon.SUCCESSFACTORS_SEARCH_URL,
    'https://career10.successfactors.com/career?company=bioconlimi&career_ns=job_listing_summary&navBarLevel=JOB_SEARCH&',
  )
  assert.equal(
    biocon.buildDetailUrl('20811'),
    'https://career10.successfactors.com/career?career_ns=job_listing&company=bioconlimi&navBarLevel=JOB_SEARCH&rcm_site_locale=en_US&career_job_req_id=20811&selected_lang=en_US&jobAlertController_jobAlertId=&jobAlertController_jobAlertName=&browserTimeZone=Asia/Calcutta',
  )
  assert.equal(biocon.hasOfficialCareersPageSignal(officialCareersHtml), true)
  assert.equal(
    biocon.extractSuccessFactorsHandoffUrl(officialCareersHtml),
    biocon.SUCCESSFACTORS_BOARD_URL,
  )
  assert.equal(biocon.hasSuccessFactorsSearchPageSignal(summaryPageOneHtml), true)
})

test('Biocon retries only a first-party certificate-chain failure through verified native HTTPS', async () => {
  const biocon = await loadModule()
  const calls = []
  const certificateError = new TypeError('fetch failed', {
    cause: Object.assign(new Error('unable to verify the first certificate'), {
      code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    }),
  })

  const html = await biocon.fetchBioconFirstPartyText(biocon.CAREERS_PAGE_URL, {
    fetchText: async () => {
      throw certificateError
    },
    execFile: async (file, args, options) => {
      calls.push({ file, args, options })
      return { stdout: officialCareersHtml }
    },
  })

  assert.equal(biocon.hasOfficialCareersPageSignal(html), true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].file, process.platform === 'win32' ? 'curl.exe' : 'curl')
  assert.equal(calls[0].args[0], '--disable')
  assert.deepEqual(calls[0].args.slice(-3), ['--proto-redir', '=https', biocon.CAREERS_PAGE_URL])
  assert.equal(calls[0].args.includes('--insecure'), false)
  assert.equal(calls[0].args.includes('-k'), false)
  assert.equal(calls[0].options.windowsHide, true)
})

test('Biocon never invokes the native transport fallback for a non-Biocon URL', async () => {
  const biocon = await loadModule()
  const certificateError = Object.assign(new Error('unable to verify leaf signature'), {
    code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  })
  let nativeCalls = 0

  await assert.rejects(
    biocon.fetchBioconFirstPartyText(biocon.SUCCESSFACTORS_BOARD_URL, {
      fetchText: async () => {
        throw certificateError
      },
      execFile: async () => {
        nativeCalls += 1
        return { stdout: '' }
      },
    }),
    /verify leaf signature/i,
  )

  assert.equal(nativeCalls, 0)
})

test('extractSearchResults parses the verified Biocon SuccessFactors result rows', async () => {
  const biocon = await loadModule()

  const jobs = biocon.extractSearchResults(summaryPageOneHtml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'MANAGER',
    company: 'Biocon',
    hiringEntity: 'BIOCON LIMITED',
    department: 'API MAINTENANCE',
    location: 'India',
    city: null,
    state: null,
    country: 'India',
    jobId: '20811',
    requisitionId: '20811',
    sourceUrl: 'https://career10.successfactors.com/career?career_ns=job_listing&company=bioconlimi&navBarLevel=JOB_SEARCH&rcm_site_locale=en_US&career_job_req_id=20811&selected_lang=en_US&jobAlertController_jobAlertId=&jobAlertController_jobAlertName=&browserTimeZone=Asia/Calcutta',
    applyUrl: 'https://career10.successfactors.com/career?career_ns=job_listing&company=bioconlimi&navBarLevel=JOB_SEARCH&rcm_site_locale=en_US&career_job_req_id=20811&selected_lang=en_US&jobAlertController_jobAlertId=&jobAlertController_jobAlertName=&browserTimeZone=Asia/Calcutta',
    link: 'https://career10.successfactors.com/career?career_ns=job_listing&company=bioconlimi&navBarLevel=JOB_SEARCH&rcm_site_locale=en_US&career_job_req_id=20811&selected_lang=en_US&jobAlertController_jobAlertId=&jobAlertController_jobAlertName=&browserTimeZone=Asia/Calcutta',
    postingDate: '2026-07-14',
    jobDescription: null,
  })
})

test('extractSearchResults parses the verified Biocon SuccessFactors DWR response pages', async () => {
  const biocon = await loadModule()

  const jobs = biocon.extractSearchResults(
    buildDwrSummaryResponse({
      currentPage: 2,
      totalCount: 39,
      postings: [
        {
          requisitionId: '20915',
          title: 'ASSISTANT MANAGER',
          postingDate: '31/07/2026',
          hiringEntity: 'BIOCON PHARMA LIMITED',
          department: 'GENERIC FORMULATION QC',
        },
        {
          requisitionId: '21071',
          title: 'SENIOR MANAGER',
          postingDate: '13/07/2026',
          hiringEntity: 'BIOCON LIMITED',
          department: 'WAREHOUSE MANAGEMENT',
        },
      ],
      wrapInPayload: false,
    }),
  )

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'ASSISTANT MANAGER',
    company: 'Biocon',
    hiringEntity: 'BIOCON PHARMA LIMITED',
    department: 'GENERIC FORMULATION QC',
    location: 'India',
    city: null,
    state: null,
    country: 'India',
    jobId: '20915',
    requisitionId: '20915',
    sourceUrl: biocon.buildDetailUrl('20915'),
    applyUrl: biocon.buildDetailUrl('20915'),
    link: biocon.buildDetailUrl('20915'),
    postingDate: '2026-07-31',
    jobDescription: null,
  })
})

test('extractJobDetail parses the verified Biocon SuccessFactors detail page', async () => {
  const biocon = await loadModule()

  const job = biocon.extractJobDetail(
    buildDetailHtml({
      requisitionId: '20811',
      title: 'MANAGER',
      postingDate: '07/14/2026',
      hiringEntity: 'BIOCON LIMITED',
      department: 'API MAINTENANCE',
      location: 'Hyderabad',
      roleSummary: 'Lead instrumentation for API operations.',
      responsibilities: 'Interact with regulatory authorities and execute maintenance projects.',
    }),
    {
      requisitionId: '20811',
      title: 'MANAGER',
      department: 'API MAINTENANCE',
      hiringEntity: 'BIOCON LIMITED',
    },
  )

  assert.equal(job.title, 'MANAGER')
  assert.equal(job.requisitionId, '20811')
  assert.equal(job.applyUrl, biocon.buildDetailUrl('20811'))
  assert.equal(job.postingDate, '2026-07-14')
  assert.equal(job.location, 'Hyderabad, India')
  assert.equal(job.city, 'Hyderabad')
  assert.equal(job.state, null)
  assert.equal(job.department, 'API MAINTENANCE')
  assert.match(job.jobDescription, /Role Summary/i)
  assert.match(job.jobDescription, /Lead instrumentation/i)
  assert.match(job.jobDescription, /regulatory authorities/i)
})

test('run verifies the Biocon careers handoff, consumes injected HTTP search pages, and enriches detail pages', async () => {
  const biocon = await loadModule()

  const requestedUrls = []
  const detailPages = {
    [biocon.buildDetailUrl('20811')]: buildDetailHtml({
      requisitionId: '20811',
      title: 'MANAGER',
      postingDate: '07/14/2026',
      hiringEntity: 'BIOCON LIMITED',
      department: 'API MAINTENANCE',
      location: 'Hyderabad',
      roleSummary: 'Lead instrumentation for API operations.',
      responsibilities: 'Interact with regulatory authorities and execute maintenance projects.',
    }),
    [biocon.buildDetailUrl('20830')]: buildDetailHtml({
      requisitionId: '20830',
      title: 'SENIOR EXECUTIVE',
      postingDate: '07/14/2026',
      hiringEntity: 'BIOCON BIOSPHERE LIMITED',
      department: 'SMV VIZ BBSL PRODUCTION US MEDIA & FERM',
      location: 'Visakhapatnam',
      roleSummary: 'Support upstream media and fermentation operations.',
      responsibilities: 'Coordinate batch execution and media preparation activities.',
    }),
    [biocon.buildDetailUrl('20820')]: buildDetailHtml({
      requisitionId: '20820',
      title: 'EXECUTIVE',
      postingDate: '07/14/2026',
      hiringEntity: 'BIOCON BIOSPHERE LIMITED',
      department: 'SMV VIZ BBSL PRODUCTION US MEDIA & FERM',
      location: 'Visakhapatnam',
      roleSummary: 'Execute day-to-day production tasks.',
      responsibilities: 'Monitor fermentation parameters and maintain shift records.',
    }),
  }

  const jobs = await biocon.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === biocon.CAREERS_PAGE_URL) return officialCareersHtml
      if (detailPages[url]) return detailPages[url]
      throw new Error(`Unexpected Biocon URL: ${url}`)
    },
    getSearchPages: async ({ searchUrl }) => {
      requestedUrls.push(searchUrl)
      return [summaryPageOneHtml, summaryPageTwoHtml]
    },
    now: () => '2026-07-15T12:00:00.000Z',
  })

  assert.deepEqual(requestedUrls.slice(0, 2), [
    'https://www.biocon.com/careers/',
    'https://career10.successfactors.com/career?company=bioconlimi&career_ns=job_listing_summary&navBarLevel=JOB_SEARCH&',
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'biocon')
  assert.equal(jobs[0].company, 'Biocon')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].companyCareerPage, 'https://www.biocon.com/careers/')
  assert.equal(jobs[0].atsPlatform, 'successfactors')
  assert.equal(jobs[0].applyUrl, biocon.buildDetailUrl('20811'))
  assert.equal(jobs[0].postingDate, '2026-07-14')
  assert.equal(jobs[0].location, 'Hyderabad, India')
  assert.equal(jobs[0].city, 'Hyderabad')
  assert.equal(jobs[0].scrapedAt, '2026-07-15T12:00:00.000Z')
  assert.match(jobs[0].jobDescription, /Role Summary/i)
  assert.match(jobs[1].jobDescription, /media preparation/i)
  assert.equal(jobs[2].title, 'EXECUTIVE')
})

test('run fails closed when the verified Biocon careers handoff or SuccessFactors search surface drifts', async () => {
  const biocon = await loadModule()

  await assert.rejects(
    biocon.run({
      fetchText: async () => `
          <html>
            <head><title>Careers at Biocon - Put your passion for science into practice</title></head>
            <body>
              <h1>Careers at Biocon</h1>
              <p>It's a chance at Biocon to work alongside some of the brightest minds in research, healthcare, pharmaceutical, biotechnology &amp; business sector.</p>
            </body>
          </html>
        `,
    }),
    /verified Biocon careers page no longer exposes the known SuccessFactors handoff/i,
  )

  await assert.rejects(
    biocon.run({
      fetchText: async () => officialCareersHtml,
      getSearchPages: async () => ['<html><body><h1>Career Opportunities</h1></body></html>'],
    }),
    /verified public SuccessFactors search surface/i,
  )
})

test('API-only run stops before returning a partial board when Biocon SuccessFactors requires unverified pagination', async () => {
  const biocon = await loadModule()

  await assert.rejects(
    biocon.run({
      fetchText: async (url) => {
        if (url === biocon.CAREERS_PAGE_URL) return officialCareersHtml
        if (url === biocon.SUCCESSFACTORS_SEARCH_URL) return summaryPageOneHtml
        throw new Error(`Unexpected Biocon URL: ${url}`)
      },
    }),
    /Biocon API-only migration required.*pagination.*browser automation is disabled/i,
  )
})
