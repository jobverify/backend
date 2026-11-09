import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const JOBS_SHELL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>SAMS List: Premium Social Sector Jobs</title>
    <meta property="og:url" content="https://www.sams.co.in/Jobs/job-list" />
  </head>
  <body>
    <main>
      <h1>Search SAMS Jobs</h1>
      <p>Premium Social Sector Jobs Awarded to SAMS</p>
      <input id="keyword" name="keyword" placeholder="Search SAMS Jobs" />
      <div id="workmode" data-filtertype="checkbox">
        <label>Work from Office</label>
        <label>Remote</label>
        <label>Hybrid</label>
      </div>
      <div class="row row-cols-1 row-cols-md-1 g-3" id="JobsList"></div>
    </main>
    <script src="/Scripts/filter.js"></script>
  </body>
</html>
`

const FILTER_SCRIPT_JS = `
$(document).ready(function () {
  displayAppliedFilters()
})
var pageNumber = 1, isLoading = false, noMoreJobs = false;
function getjoblist(params) {
  var payload = new FormData
  params.forEach(function (value, key) { payload.append(key, value) })
  $.ajax({
    url: "/Jobs/JobsList",
    type: "POST",
    dataType: "html",
    data: payload,
    cache: false,
    processData: false,
    contentType: false
  })
}
$(window).scroll(function () {
  if (!isLoading && !noMoreJobs) {
    pageNumber++;
    var payload = new FormData;
    payload.append("PageNumber", pageNumber);
    $.ajax({ url: "/Jobs/JobsList", type: "POST", data: payload });
  }
});
`

const JOBS_FRAGMENT_HTML = `
<div class="col">
  <a href="/jobs/job-description/program-manager/537" target="_blank">
    <div class="job-list">
      <div class="job-list-details">
        <div class="job-list-info">
          <div class="job-list-title">
            <h5 class="mb-0">Program Manager</h5>
          </div>
          <div class="job-list-option">
            <ul class="list-unstyled">
              <li>Smile Train</li>
              <li class=""><span class="full-time">Full Time</span></li>
              <li>Program Management</li>
            </ul>
            <ul class="list-unstyled">
              <li>New Delhi</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </a>
</div>
<div class="col">
  <a href="/jobs/job-description/state-project-manager/523" target="_blank">
    <div class="job-list">
      <div class="job-list-details">
        <div class="job-list-info">
          <div class="job-list-title">
            <h5 class="mb-0">State Project Manager</h5>
          </div>
          <div class="job-list-option">
            <ul class="list-unstyled">
              <li>SAMS HR Consulting</li>
              <li class=""><span class="full-time">Full Time</span></li>
              <li>Programme Management</li>
            </ul>
            <ul class="list-unstyled">
              <li>Andhra Pradesh</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </a>
</div>
<div class="col">
  <a href="/jobs/job-description/country-coordinator-nepal/999" target="_blank">
    <div class="job-list">
      <div class="job-list-details">
        <div class="job-list-info">
          <div class="job-list-title">
            <h5 class="mb-0">Country Coordinator</h5>
          </div>
          <div class="job-list-option">
            <ul class="list-unstyled">
              <li>Example Foundation</li>
              <li class=""><span class="full-time">Full Time</span></li>
              <li>Operations</li>
            </ul>
            <ul class="list-unstyled">
              <li>Kathmandu, Nepal</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </a>
</div>
`

const PROGRAM_MANAGER_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Program Manager, New Delhi</title>
  </head>
  <body>
    <div class="jd-job-favourite-time">
      <div class="row">
        <div class="col-6 col-md-12 col-xl-12"><p>Application ends: <span>July 29, 2026</span></p></div>
        <div class="col-6 col-md-12 col-xl-12">
          <div class="widget d-grid text-dark">
            <a class="btn btn-primary" href="https://www.samsstc.com/Jobs/job-description/program-manager-smile-train-new-delhi/662">
              Apply for job
            </a>
          </div>
        </div>
      </div>
    </div>
    <table>
      <tr>
        <td><p class="fw-bold">Location:</p><p>New Delhi</p></td>
        <td><p class="fw-bold">Working:</p><p>Full Time</p></td>
      </tr>
    </table>
    <div class="job-description">
      <p>Smile Train is hiring a Program Manager to support cleft care partnerships across India.</p>
      <p><strong>7. LOCATION:</strong> New Delhi</p>
      <p><strong>8. REFERENCE: PM-ST</strong></p>
      <p><strong>10. APPLICATION PROCESS:</strong></p>
      <p>Eligible candidates interested in this position are requested to apply online at <a href="https://www.samsstc.com/Jobs/job-description/program-manager-smile-train-new-delhi/662">external apply</a>.</p>
    </div>
  </body>
</html>
`

const STATE_PROJECT_MANAGER_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>State Project Manager, Andhra Pradesh</title>
  </head>
  <body>
    <div class="jd-job-favourite-time">
      <div class="row">
        <div class="col-6 col-md-12 col-xl-12"><p>Application ends: <span>July 20, 2026</span></p></div>
        <div class="col-6 col-md-12 col-xl-12">
          <div class="widget d-grid text-dark">
            <a class="btn btn-primary" href="https://www.samsstc.com/Jobs/job-description/state-project-manager-sams-hr-consulting-andhra-pradesh/171">
              Apply for job
            </a>
          </div>
        </div>
      </div>
    </div>
    <table>
      <tr>
        <td><p class="fw-bold">Location:</p><p>Andhra Pradesh</p></td>
        <td><p class="fw-bold">Working:</p><p>Full Time</p></td>
      </tr>
    </table>
    <div class="job-description">
      <p>SAMS is hiring a State Project Manager to support a field implementation program.</p>
      <p><strong>7. LOCATION:</strong> Rayachoty, Annamaya District, Andhra Pradesh</p>
      <p><strong>8. REFERENCE: SPM-AP-SAMS</strong></p>
      <p><strong>10. APPLICATION PROCESS:</strong></p>
      <p>Eligible candidates interested in this position are requested to apply online at <a href="https://www.samsstc.com/Jobs/job-description/state-project-manager-sams-hr-consulting-andhra-pradesh/171">external apply</a>.</p>
    </div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/sams/script.js')
  } catch {
    assert.fail('Expected SAMS scraper module at ../../scraper/sams/script.js')
  }
}

test('SAMS helper exports stay pinned to the verified jobs shell, script asset, and listing fragment shape', async () => {
  const sams = await loadModule()

  assert.equal(sams.SOURCE, 'sams')
  assert.equal(sams.COMPANY, 'SAMS')
  assert.equal(sams.OFFICIAL_BRAND_NAME, 'SAMS')
  assert.equal(sams.VERIFIED_ON, '2026-07-17')
  assert.equal(sams.HOMEPAGE_URL, 'https://www.sams.co.in/')
  assert.equal(sams.CAREERS_PAGE_URL, 'https://www.sams.co.in/Jobs/job-list')
  assert.equal(sams.FILTER_SCRIPT_URL, 'https://www.sams.co.in/Scripts/filter.js')
  assert.equal(sams.JOBS_FRAGMENT_URL, 'https://www.sams.co.in/Jobs/JobsList')
  assert.equal(sams.hasOfficialJobsShellSignal(JOBS_SHELL_HTML), true)
  assert.equal(sams.hasJobsListScriptSignal(FILTER_SCRIPT_JS), true)
  assert.deepEqual(sams.extractJobCards(JOBS_FRAGMENT_HTML), [
    {
      title: 'Program Manager',
      company: 'SAMS',
      department: 'Program Management',
      location: 'New Delhi, India',
      city: 'Delhi',
      country: 'India',
      jobId: '537',
      requisitionId: '537',
      sourceUrl: 'https://www.sams.co.in/jobs/job-description/program-manager/537',
      applyUrl: 'https://www.sams.co.in/jobs/job-description/program-manager/537',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
      hiringOrganization: 'Smile Train',
    },
    {
      title: 'State Project Manager',
      company: 'SAMS',
      department: 'Programme Management',
      location: 'Andhra Pradesh, India',
      city: null,
      country: 'India',
      jobId: '523',
      requisitionId: '523',
      sourceUrl: 'https://www.sams.co.in/jobs/job-description/state-project-manager/523',
      applyUrl: 'https://www.sams.co.in/jobs/job-description/state-project-manager/523',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
      hiringOrganization: 'SAMS HR Consulting',
    },
  ])
})

test('SAMS detail extraction preserves the first-party detail URL and external apply handoff', async () => {
  const sams = await loadModule()

  const detail = sams.extractJobDetail(PROGRAM_MANAGER_DETAIL_HTML, {
    title: 'Program Manager',
    company: 'SAMS',
    department: 'Program Management',
    location: 'New Delhi, India',
    city: 'Delhi',
    country: 'India',
    jobId: '537',
    requisitionId: '537',
    sourceUrl: 'https://www.sams.co.in/jobs/job-description/program-manager/537',
    applyUrl: 'https://www.sams.co.in/jobs/job-description/program-manager/537',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: null,
    hiringOrganization: 'Smile Train',
  })

  assert.deepEqual(detail, {
    title: 'Program Manager',
    company: 'SAMS',
    department: 'Program Management',
    location: 'New Delhi, India',
    city: 'Delhi',
    country: 'India',
    jobId: '537',
    requisitionId: 'PM-ST',
    sourceUrl: 'https://www.sams.co.in/jobs/job-description/program-manager/537',
    applyUrl: 'https://www.samsstc.com/Jobs/job-description/program-manager-smile-train-new-delhi/662',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: '2026-07-29',
    jobDescription:
      'Smile Train is hiring a Program Manager to support cleft care partnerships across India.',
    remoteStatus: null,
    hiringOrganization: 'Smile Train',
  })
})

test('SAMS run verifies the official shell, reads the first public jobs fragment, and enriches same-domain detail pages', async () => {
  const sams = await loadModule()
  const requestedTextUrls = []
  const posted = []

  const jobs = await sams.createSamsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)

      if (url === sams.CAREERS_PAGE_URL) return JOBS_SHELL_HTML
      if (url === sams.FILTER_SCRIPT_URL) return FILTER_SCRIPT_JS
      if (url === 'https://www.sams.co.in/jobs/job-description/program-manager/537') {
        return PROGRAM_MANAGER_DETAIL_HTML
      }
      if (url === 'https://www.sams.co.in/jobs/job-description/state-project-manager/523') {
        return STATE_PROJECT_MANAGER_DETAIL_HTML
      }

      throw new Error(`Unexpected SAMS URL: ${url}`)
    },
    postForm: async (url, body) => {
      posted.push({ url, body })
      return JOBS_FRAGMENT_HTML
    },
  })

  assert.deepEqual(requestedTextUrls, [
    sams.CAREERS_PAGE_URL,
    sams.FILTER_SCRIPT_URL,
    'https://www.sams.co.in/jobs/job-description/program-manager/537',
    'https://www.sams.co.in/jobs/job-description/state-project-manager/523',
  ])
  assert.deepEqual(posted, [
    {
      url: sams.JOBS_FRAGMENT_URL,
      body: {},
    },
  ])

  assert.deepEqual(jobs, [
    {
      title: 'Program Manager',
      company: 'SAMS',
      department: 'Program Management',
      location: 'New Delhi, India',
      city: 'Delhi',
      country: 'India',
      jobId: '537',
      requisitionId: 'PM-ST',
      sourceUrl: 'https://www.sams.co.in/jobs/job-description/program-manager/537',
      applyUrl: 'https://www.samsstc.com/Jobs/job-description/program-manager-smile-train-new-delhi/662',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: '2026-07-29',
      jobDescription:
        'Smile Train is hiring a Program Manager to support cleft care partnerships across India.',
      remoteStatus: null,
      hiringOrganization: 'Smile Train',
      source: 'sams',
      link: 'https://www.samsstc.com/Jobs/job-description/program-manager-smile-train-new-delhi/662',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'State Project Manager',
      company: 'SAMS',
      department: 'Programme Management',
      location: 'Rayachoty, Annamaya District, Andhra Pradesh, India',
      city: 'Rayachoty',
      country: 'India',
      jobId: '523',
      requisitionId: 'SPM-AP-SAMS',
      sourceUrl: 'https://www.sams.co.in/jobs/job-description/state-project-manager/523',
      applyUrl: 'https://www.samsstc.com/Jobs/job-description/state-project-manager-sams-hr-consulting-andhra-pradesh/171',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: '2026-07-20',
      jobDescription:
        'SAMS is hiring a State Project Manager to support a field implementation program.',
      remoteStatus: null,
      hiringOrganization: 'SAMS HR Consulting',
      source: 'sams',
      link: 'https://www.samsstc.com/Jobs/job-description/state-project-manager-sams-hr-consulting-andhra-pradesh/171',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('SAMS fails closed when the verified jobs shell, script asset, or fragment contract drifts materially', async () => {
  const sams = await loadModule()

  await assert.rejects(
    sams.createSamsScraper().run({
      fetchText: async (url) => {
        if (url === sams.CAREERS_PAGE_URL) return '<html><body><h1>Unexpected</h1></body></html>'
        if (url === sams.FILTER_SCRIPT_URL) return FILTER_SCRIPT_JS
        throw new Error(`Unexpected SAMS URL: ${url}`)
      },
      postForm: async () => JOBS_FRAGMENT_HTML,
    }),
    /verified sams jobs shell/i,
  )

  await assert.rejects(
    sams.createSamsScraper().run({
      fetchText: async (url) => {
        if (url === sams.CAREERS_PAGE_URL) return JOBS_SHELL_HTML
        if (url === sams.FILTER_SCRIPT_URL) return 'console.log("no jobs endpoint")'
        throw new Error(`Unexpected SAMS URL: ${url}`)
      },
      postForm: async () => JOBS_FRAGMENT_HTML,
    }),
    /verified sams filter script/i,
  )

  await assert.rejects(
    sams.createSamsScraper().run({
      fetchText: async (url) => {
        if (url === sams.CAREERS_PAGE_URL) return JOBS_SHELL_HTML
        if (url === sams.FILTER_SCRIPT_URL) return FILTER_SCRIPT_JS
        throw new Error(`Unexpected SAMS URL: ${url}`)
      },
      postForm: async () => '<div><h1>Unexpected</h1></div>',
    }),
    /verified sams jobs fragment/i,
  )
})
