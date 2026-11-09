import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Home page | ECIL | DAE | India</title>
  </head>
  <body>
    <nav>
      <a href="/jobopenings">Current Job Openings</a>
      <a href="/results">Selections/ Results</a>
      <a href="/apprenticeship">Apprenticeship Opportunities</a>
    </nav>
    <main>
      <h1>Electronics Corporation of India Limited</h1>
    </main>
  </body>
</html>
`

const PAGE_ONE_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Current Job Openings | ECIL | DAE | India</title>
    <link rel="canonical" href="https://www.ecil.co.in/jobopenings">
  </head>
  <body>
    <div id="w0" class="grid-view">
      <div class="summary">Showing <b>1-10</b> of <b>12</b> items.</div>
      <table class="table table-bordered table-hover table-striped w-100">
        <thead>
          <tr><th>S.No</th><th>Advt No</th><th>Short Description</th><th>Documents</th><th>Links</th></tr>
        </thead>
        <tbody>
          <tr data-key="10/2026">
            <td>1</td>
            <td>10/2026</td>
            <td>Empanelment of Retired Government Executives as Inquiry Officers for conducting Departmental Inquiries</td>
            <td>
              <ul class="list-unstyled">
                <li><a href="/jobs/Advt_10_2026.pdf" target="_blank" data-pjax="0">Advertisement</a> <small>(pdf / 1.02 MiB)</small></li>
                <li><a href="/jobs/Appl_Form_IO.pdf" target="_blank" data-pjax="0">Application Form</a> <small>(pdf / 196.23 KiB)</small></li>
              </ul>
            </td>
            <td><div></div></td>
          </tr>
          <tr data-key="09/2026">
            <td>2</td>
            <td>09/2026</td>
            <td>Walk-in interview for selection of dynamic, experienced and result oriented personnel for various posts purely on fixed tenure contract basis</td>
            <td>
              <ul class="list-unstyled">
                <li><a href="/jobs/Advt_09_2026.pdf" target="_blank" data-pjax="0">Advertisement</a> <small>(pdf / 1.29 MiB)</small></li>
                <li><a href="/jobs/Advt_Annexure_09_2026.pdf" target="_blank" data-pjax="0">Annexure</a> <small>(pdf / 203.18 KiB)</small></li>
                <li><a href="/jobs/Corrigendum_09_2026.pdf" target="_blank" data-pjax="0">Corrigendum</a> <small>(pdf / 518.55 KiB)</small></li>
                <li><a href="/jobs/Corrigendum2_09_2026.pdf" target="_blank" data-pjax="0">Corrigendum-II</a> <small>(pdf / 426.78 KiB)</small></li>
                <li><a href="/jobs/Walkin_Application_Form.pdf" target="_blank" data-pjax="0">Application Form</a> <small>(pdf / 561.11 KiB)</small></li>
              </ul>
            </td>
            <td><div></div></td>
          </tr>
          <tr data-key="03/2026">
            <td>8</td>
            <td>03/2026</td>
            <td>Online applications are invited for various posts purely on fixed tenure contract basis such as Project Engineers on Contract for an initial period of One Year</td>
            <td>
              <ul class="list-unstyled">
                <li><a href="/jobs/Advt_03_2026.pdf" target="_blank" data-pjax="0">Advertisement</a> <small>(pdf / 1.11 MiB)</small></li>
              </ul>
            </td>
            <td><div></div></td>
          </tr>
        </tbody>
      </table>
      <ul class="pagination">
        <li class="prev disabled"><span>&laquo;</span></li>
        <li class="active"><a href="/jobopenings" data-page="0">1</a></li>
        <li><a href="/jobopenings?page=2" data-page="1">2</a></li>
        <li class="next"><a href="/jobopenings?page=2" data-page="1">&raquo;</a></li>
      </ul>
    </div>
  </body>
</html>
`

const PAGE_TWO_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Current Job Openings | ECIL | DAE | India</title>
    <link rel="canonical" href="https://www.ecil.co.in/jobopenings?page=2">
  </head>
  <body>
    <div id="w0" class="grid-view">
      <div class="summary">Showing <b>11-12</b> of <b>12</b> items.</div>
      <table class="table table-bordered table-hover table-striped w-100">
        <thead>
          <tr><th>S.No</th><th>Advt No</th><th>Short Description</th><th>Documents</th><th>Links</th></tr>
        </thead>
        <tbody>
          <tr data-key="06/2025">
            <td>11</td>
            <td>06/2025</td>
            <td>Applications are invited for the posts of 'Graduate Engineer Trainees(GET)'</td>
            <td>
              <ul class="list-unstyled">
                <li><a href="/jobs/Advt_06_2025.pdf" target="_blank" data-pjax="0">Advertisement</a> <small>(pdf / 300.43 KiB)</small></li>
                <li><a href="/jobs/Advt_CBT_Info_06_2025.pdf" target="_blank" data-pjax="0">Information w.r.t. CBT</a> <small>(pdf / 2.85 MiB)</small></li>
              </ul>
            </td>
            <td><div><a href="https://ecerp01.ecil.gov.in/ecilerec/reprint#" target="_blank" data-pjax="0">Reprint Application</a></div></td>
          </tr>
          <tr data-key="HRM-3400/ 2025-26">
            <td>12</td>
            <td>HRM-3400/ 2025-26</td>
            <td>Online Applications are invited from deserving and meritorius Under-Graduate Engineering Students for Scholarship Scheme instituted by ECIL.</td>
            <td>
              <ul class="list-unstyled">
                <li><a href="/jobs/HRM_SCH_3400_202526.pdf" target="_blank" data-pjax="0">Scheme Advertisement</a> <small>(pdf / 944.70 KiB)</small></li>
                <li><a href="/jobs/Corrigendum_to_HR_Circular_3400_2025-26.pdf" target="_blank" data-pjax="0">Corrigendum</a> <small>(pdf / 272.83 KiB)</small></li>
              </ul>
            </td>
            <td>
              <div>
                <a href="https://www.ecil.co.in/jobs/FAQ_2024.pdf" target="_blank" data-pjax="0">FAQs</a><br>
                <a href="https://ecerp01.ecil.gov.in/ecilerec/reprint#" target="_blank" data-pjax="0">Reprint Application</a>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <ul class="pagination">
        <li class="prev"><a href="/jobopenings" data-page="0">&laquo;</a></li>
        <li><a href="/jobopenings" data-page="0">1</a></li>
        <li class="active"><a href="/jobopenings?page=2" data-page="1">2</a></li>
        <li class="next disabled"><span>&raquo;</span></li>
      </ul>
    </div>
  </body>
</html>
`

const BROKEN_PAGE_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Current Job Openings | ECIL | DAE | India</title>
  </head>
  <body>
    <h1>Current Job Openings</h1>
    <p>No grid available.</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/electronicscorporationofindialimited/script.js')
  } catch {
    assert.fail(
      'Expected Electronics Corporation of India Limited scraper module at ../../scraper/electronicscorporationofindialimited/script.js',
    )
  }
}

test('ECIL exports the verified homepage and two-page current job openings contract from July 15, 2026', async () => {
  const ecil = await loadModule()

  assert.equal(ecil.SOURCE, 'electronicscorporationofindialimited')
  assert.equal(ecil.COMPANY, 'Electronics Corporation of India Limited')
  assert.equal(ecil.OFFICIAL_BRAND_NAME, 'ECIL')
  assert.equal(ecil.VERIFIED_AT, '2026-07-15')
  assert.equal(ecil.HOMEPAGE_URL, 'https://www.ecil.co.in/')
  assert.equal(ecil.CURRENT_JOB_OPENINGS_URL, 'https://www.ecil.co.in/jobopenings')
  assert.equal(ecil.PAGE_TWO_URL, 'https://www.ecil.co.in/jobopenings?page=2')
  assert.equal(ecil.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(
    ecil.extractCurrentJobOpeningsUrl(HOMEPAGE_HTML),
    'https://www.ecil.co.in/jobopenings',
  )
  assert.equal(ecil.hasVerifiedCurrentJobOpeningsSignal(PAGE_ONE_HTML), true)
  assert.equal(ecil.hasVerifiedCurrentJobOpeningsSignal(PAGE_TWO_HTML), true)
  assert.deepEqual(ecil.extractPaginationSummary(PAGE_ONE_HTML), {
    start: 1,
    end: 10,
    total: 12,
  })
  assert.deepEqual(ecil.extractPaginationSummary(PAGE_TWO_HTML), {
    start: 11,
    end: 12,
    total: 12,
  })
  assert.equal(
    ecil.extractNextPageUrl(PAGE_ONE_HTML),
    'https://www.ecil.co.in/jobopenings?page=2',
  )
  assert.equal(ecil.extractNextPageUrl(PAGE_TWO_HTML), null)
})

test('ECIL extracts paginated openings and prefers first-party application-form PDFs when present', async () => {
  const ecil = await loadModule()

  const pageOneJobs = ecil.extractOpeningsFromPage(PAGE_ONE_HTML)
  const pageTwoJobs = ecil.extractOpeningsFromPage(PAGE_TWO_HTML)

  assert.deepEqual(pageOneJobs, [
    {
      title: 'Empanelment of Retired Government Executives as Inquiry Officers for conducting Departmental Inquiries',
      company: 'Electronics Corporation of India Limited',
      department: null,
      location: 'India',
      city: null,
      state: null,
      country: 'India',
      jobId: 'ecil-10-2026',
      requisitionId: '10-2026',
      sourceUrl: 'https://www.ecil.co.in/jobs/Advt_10_2026.pdf',
      applyUrl: 'https://www.ecil.co.in/jobs/Appl_Form_IO.pdf',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official ECIL current job opening (10/2026). See the linked first-party documents for eligibility, schedule, and application details.',
    },
    {
      title: 'Walk-in interview for selection of dynamic, experienced and result oriented personnel for various posts purely on fixed tenure contract basis',
      company: 'Electronics Corporation of India Limited',
      department: null,
      location: 'India',
      city: null,
      state: null,
      country: 'India',
      jobId: 'ecil-09-2026',
      requisitionId: '09-2026',
      sourceUrl: 'https://www.ecil.co.in/jobs/Advt_09_2026.pdf',
      applyUrl: 'https://www.ecil.co.in/jobs/Walkin_Application_Form.pdf',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official ECIL current job opening (09/2026). See the linked first-party documents for eligibility, schedule, and application details.',
    },
    {
      title: 'Online applications are invited for various posts purely on fixed tenure contract basis such as Project Engineers on Contract for an initial period of One Year',
      company: 'Electronics Corporation of India Limited',
      department: null,
      location: 'India',
      city: null,
      state: null,
      country: 'India',
      jobId: 'ecil-03-2026',
      requisitionId: '03-2026',
      sourceUrl: 'https://www.ecil.co.in/jobs/Advt_03_2026.pdf',
      applyUrl: 'https://www.ecil.co.in/jobs/Advt_03_2026.pdf',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official ECIL current job opening (03/2026). See the linked first-party documents for eligibility, schedule, and application details.',
    },
  ])

  assert.deepEqual(pageTwoJobs, [
    {
      title: "Applications are invited for the posts of 'Graduate Engineer Trainees(GET)'",
      company: 'Electronics Corporation of India Limited',
      department: null,
      location: 'India',
      city: null,
      state: null,
      country: 'India',
      jobId: 'ecil-06-2025',
      requisitionId: '06-2025',
      sourceUrl: 'https://www.ecil.co.in/jobs/Advt_06_2025.pdf',
      applyUrl: 'https://www.ecil.co.in/jobs/Advt_06_2025.pdf',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official ECIL current job opening (06/2025). See the linked first-party documents for eligibility, schedule, and application details.',
    },
    {
      title: 'Online Applications are invited from deserving and meritorius Under-Graduate Engineering Students for Scholarship Scheme instituted by ECIL.',
      company: 'Electronics Corporation of India Limited',
      department: null,
      location: 'India',
      city: null,
      state: null,
      country: 'India',
      jobId: 'ecil-hrm-3400-2025-26',
      requisitionId: 'hrm-3400-2025-26',
      sourceUrl: 'https://www.ecil.co.in/jobs/HRM_SCH_3400_202526.pdf',
      applyUrl: 'https://www.ecil.co.in/jobs/HRM_SCH_3400_202526.pdf',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official ECIL current job opening (HRM-3400/ 2025-26). See the linked first-party documents for eligibility, schedule, and application details.',
    },
  ])
})

test('ECIL runner validates the official homepage and both grid pages, then decorates the extracted openings', async () => {
  const ecil = await loadModule()
  const requestedUrls = []

  const jobs = await ecil.createElectronicsCorporationOfIndiaLimitedScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === ecil.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === ecil.CURRENT_JOB_OPENINGS_URL) return PAGE_ONE_HTML
      if (url === ecil.PAGE_TWO_URL) return PAGE_TWO_HTML

      throw new Error(`Unexpected ECIL URL: ${url}`)
    },
    now: () => '2026-07-15T12:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://www.ecil.co.in/',
    'https://www.ecil.co.in/jobopenings',
    'https://www.ecil.co.in/jobopenings?page=2',
  ])
  assert.equal(jobs.length, 5)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.source, job.link, job.scrapedAt]),
    [
      [
        'Empanelment of Retired Government Executives as Inquiry Officers for conducting Departmental Inquiries',
        'electronicscorporationofindialimited',
        'https://www.ecil.co.in/jobs/Appl_Form_IO.pdf',
        '2026-07-15T12:00:00.000Z',
      ],
      [
        'Walk-in interview for selection of dynamic, experienced and result oriented personnel for various posts purely on fixed tenure contract basis',
        'electronicscorporationofindialimited',
        'https://www.ecil.co.in/jobs/Walkin_Application_Form.pdf',
        '2026-07-15T12:00:00.000Z',
      ],
      [
        'Online applications are invited for various posts purely on fixed tenure contract basis such as Project Engineers on Contract for an initial period of One Year',
        'electronicscorporationofindialimited',
        'https://www.ecil.co.in/jobs/Advt_03_2026.pdf',
        '2026-07-15T12:00:00.000Z',
      ],
      [
        "Applications are invited for the posts of 'Graduate Engineer Trainees(GET)'",
        'electronicscorporationofindialimited',
        'https://www.ecil.co.in/jobs/Advt_06_2025.pdf',
        '2026-07-15T12:00:00.000Z',
      ],
      [
        'Online Applications are invited from deserving and meritorius Under-Graduate Engineering Students for Scholarship Scheme instituted by ECIL.',
        'electronicscorporationofindialimited',
        'https://www.ecil.co.in/jobs/HRM_SCH_3400_202526.pdf',
        '2026-07-15T12:00:00.000Z',
      ],
    ],
  )
})

test('ECIL fails closed when the homepage or job openings grid drifts away from the verified contract', async () => {
  const ecil = await loadModule()

  await assert.rejects(
    ecil.createElectronicsCorporationOfIndiaLimitedScraper().run({
      fetchText: async (url) => {
        if (url === ecil.HOMEPAGE_URL) {
          return '<html><head><title>Home</title></head><body><a href="/careers">Careers</a></body></html>'
        }

        throw new Error(`Unexpected ECIL URL: ${url}`)
      },
    }),
    /homepage no longer matches the verified official surface/i,
  )

  await assert.rejects(
    ecil.createElectronicsCorporationOfIndiaLimitedScraper().run({
      fetchText: async (url) => {
        if (url === ecil.HOMEPAGE_URL) return HOMEPAGE_HTML
        if (url === ecil.CURRENT_JOB_OPENINGS_URL) return BROKEN_PAGE_HTML

        throw new Error(`Unexpected ECIL URL: ${url}`)
      },
    }),
    /current job openings page no longer matches the verified official surface/i,
  )
})

test('ECIL follows the official language landing page before validating the careers handoff', async () => {
  const ecil = await loadModule()
  const landingHtml = `<title>Electronics Corporation of India Limited | DAE | India</title>
    <img alt="ECIL Logo"><form id="language-switcher-form">
    <a href="/home" onclick="changeLang('en'); return false;">English</a></form>`
  const requests = []
  const jobs = await ecil.run({ fetchText: async (url) => {
    requests.push(url)
    if (url === ecil.HOMEPAGE_URL) return landingHtml
    if (url === 'https://www.ecil.co.in/home') return HOMEPAGE_HTML
    if (url === ecil.CURRENT_JOB_OPENINGS_URL) return PAGE_ONE_HTML
    if (url === ecil.PAGE_TWO_URL) return PAGE_TWO_HTML
    throw new Error(`Unexpected URL: ${url}`)
  } })
  assert.equal(jobs.length, 5)
  assert.equal(requests[1], 'https://www.ecil.co.in/home')
  await assert.rejects(ecil.run({ fetchText: async (url) => url === ecil.HOMEPAGE_URL ? landingHtml : '<title>Unrelated</title>' }), /homepage/)
})
