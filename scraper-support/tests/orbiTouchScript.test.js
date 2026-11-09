import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const JOB_LIST_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs (List) | orbitouch-hr</title>
  </head>
  <body>
    <h1>Job Listings</h1>
    <p>Number of jobs found:</p>
    <p>4</p>
    <p>OrbiTouch HR is operated by OrbiTouch Outsourcing Private Limited</p>
    <div role="list">
      <div role="listitem">
        <h2><span>Recruitment Officer </span></h2>
        <p><span>Pune, Maharashtra, India</span></p>
        <a href="https://www.orbitouch-hr.com/jobs/recruitment-officer-"><span>View Job</span></a>
      </div>
      <div role="listitem">
        <h2><span>Dot Net Developer</span></h2>
        <p><span>Chennai, Tamil Nadu, India</span></p>
        <a href="https://www.orbitouch-hr.com/jobs/dot-net-developer"><span>View Job</span></a>
      </div>
    </div>
    <script>
      {"appsWarmupData":{"dataBinding":{"schemas":{"Jobs":{"id":"Jobs"}}},"userFilterInitialData-comp-lxtz5j198":[{"fieldName":"title","role":"userInputFilterDropdownRole","options":["Recruitment Officer ","Dot Net Developer","Business Development Manager - International Sales","Project Manager – Network Transformation"]}]}}
    </script>
  </body>
</html>
`

const RECRUITMENT_OFFICER_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Recruitment Officer</title>
    <meta name="description" content="Profile- Recruitment Officer Location- Pune Experience- 5 + years Qualification- Graduate" />
  </head>
  <body>
    <a href="/jobs">&lt; Back</a>
    <h1>Recruitment Officer</h1>
    Apply Now
    Pune, Maharashtra, India
    Job Type
    full time
    Workspace
    onsite
    About the Role
    Profile- Recruitment Officer
    Location- Pune
    Experience- 5 + years
    Ctc- Negotiable
    Working days- 6 days
    Requirement
    Qualification- Graduate
    Minimum 5-8 years experience in recruitment of personnel in manufacturing sector
    Good communication skills
    Responsibilities
    Planning and executing recruitment activity
    On-boarding of new candidates
    Apply Now
    Want to learn more?
  </body>
</html>
`

const DOT_NET_DEVELOPER_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Dot Net Developer</title>
  </head>
  <body>
    <a href="/jobs">&lt; Back</a>
    <h1>Dot Net Developer</h1>
    Apply Now
    Chennai, Tamil Nadu, India
    Job Type
    full time
    Workspace
    hybrid
    About the Role
    Profile- Dot Net Developer
    Location- Chennai
    Experience- 4+ years
    Requirement
    Qualification- B.E / B.Tech
    Strong ASP.NET and C# experience
    Responsibilities
    Build enterprise applications
    Want to learn more?
  </body>
</html>
`

const BUSINESS_DEVELOPMENT_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Business Development Manager - International Sales</title>
  </head>
  <body>
    <a href="/jobs">&lt; Back</a>
    <h1>Business Development Manager - International Sales</h1>
    Apply Now
    Mumbai, Maharashtra, India
    Job Type
    full time
    Workspace
    remote
    About the Role
    Profile- Business Development Manager - International Sales
    Location- Mumbai
    Experience- 7 years
    Requirement
    Qualification- MBA
    Experience in global B2B sales
    Responsibilities
    Build international sales pipeline
    Want to learn more?
  </body>
</html>
`

const PROJECT_MANAGER_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Project Manager – Network Transformation</title>
  </head>
  <body>
    <a href="/jobs">&lt; Back</a>
    <h1>Project Manager – Network Transformation</h1>
    Apply Now
    Noida, Uttar Pradesh, India
    Job Type
    contract
    Workspace
    onsite
    About the Role
    Profile- Project Manager – Network Transformation
    Location- Noida
    Experience- 10 years
    Requirement
    Qualification- B.Tech
    Network transformation delivery experience
    Responsibilities
    Lead large transformation projects
    Want to learn more?
  </body>
</html>
`

const loadOrbiTouchModule = async () => {
  try {
    return await import('../../scraper/orbitouch/script.js')
  } catch {
    assert.fail('Expected OrbiTouch scraper module at ../../scraper/orbitouch/script.js')
  }
}

test('OrbiTouch helpers verify the official first-party jobs board, title options, visible listings, and title-derived URLs', async () => {
  const orbitouch = await loadOrbiTouchModule()

  assert.equal(orbitouch.SOURCE, 'orbitouch')
  assert.equal(orbitouch.COMPANY, 'OrbiTouch')
  assert.equal(orbitouch.HOMEPAGE_URL, 'https://www.orbitouch-hr.com/')
  assert.equal(orbitouch.JOBS_URL, 'https://www.orbitouch-hr.com/jobs')
  assert.equal(orbitouch.SUBMIT_CV_URL, 'https://www.orbitouch-hr.com/careers')
  assert.equal(orbitouch.VERIFIED_ON, '2026-07-17')
  assert.equal(orbitouch.hasOfficialJobsBoardSignal(JOB_LIST_HTML), true)
  assert.equal(
    orbitouch.buildJobUrlFromTitle('Business Development Manager - International Sales'),
    'https://www.orbitouch-hr.com/jobs/business-development-manager---international-sales',
  )
  assert.equal(
    orbitouch.buildJobUrlFromTitle('Project Manager – Network Transformation'),
    'https://www.orbitouch-hr.com/jobs/project-manager-%E2%80%93-network-transformation',
  )
  assert.deepEqual(orbitouch.extractAllJobTitles(JOB_LIST_HTML), [
    'Recruitment Officer ',
    'Dot Net Developer',
    'Business Development Manager - International Sales',
    'Project Manager – Network Transformation',
  ])
  assert.deepEqual(orbitouch.extractVisibleListings(JOB_LIST_HTML), [
    {
      title: 'Recruitment Officer',
      location: 'Pune, Maharashtra, India',
      sourceUrl: 'https://www.orbitouch-hr.com/jobs/recruitment-officer-',
      applyUrl: 'https://www.orbitouch-hr.com/jobs/recruitment-officer-',
      jobId: 'recruitment-officer-',
      requisitionId: 'recruitment-officer-',
    },
    {
      title: 'Dot Net Developer',
      location: 'Chennai, Tamil Nadu, India',
      sourceUrl: 'https://www.orbitouch-hr.com/jobs/dot-net-developer',
      applyUrl: 'https://www.orbitouch-hr.com/jobs/dot-net-developer',
      jobId: 'dot-net-developer',
      requisitionId: 'dot-net-developer',
    },
  ])
})

test('OrbiTouch detail extraction keeps title, location, employment type, workspace, experience, and qualifications stable', async () => {
  const orbitouch = await loadOrbiTouchModule()

  const detail = orbitouch.extractJobDetail(RECRUITMENT_OFFICER_DETAIL_HTML, {
    title: 'Recruitment Officer',
    location: 'Pune, Maharashtra, India',
    sourceUrl: 'https://www.orbitouch-hr.com/jobs/recruitment-officer-',
    applyUrl: 'https://www.orbitouch-hr.com/jobs/recruitment-officer-',
    jobId: 'recruitment-officer-',
    requisitionId: 'recruitment-officer-',
  })

  assert.equal(detail.title, 'Recruitment Officer')
  assert.equal(detail.company, 'OrbiTouch')
  assert.equal(detail.location, 'Pune, Maharashtra, India')
  assert.equal(detail.city, 'Pune')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, 'recruitment-officer-')
  assert.equal(detail.requisitionId, 'recruitment-officer-')
  assert.equal(detail.sourceUrl, 'https://www.orbitouch-hr.com/jobs/recruitment-officer-')
  assert.equal(detail.applyUrl, 'https://www.orbitouch-hr.com/jobs/recruitment-officer-')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.workModel, 'Onsite')
  assert.equal(detail.experienceRequired, '5+ years')
  assert.equal(detail.minimumQualification, 'Graduate')
  assert.match(detail.jobDescription, /Planning and executing recruitment activity/i)
})

test('OrbiTouch run validates the official jobs board, combines visible listings with title-derived detail URLs, and decorates shared runner fields', async () => {
  const orbitouch = await loadOrbiTouchModule()
  const requests = []
  const scraper = orbitouch.createOrbiTouchScraper({ now: () => FIXED_SCRAPED_AT })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requests.push(url)

      if (url === orbitouch.JOBS_URL) return JOB_LIST_HTML
      if (url === 'https://www.orbitouch-hr.com/jobs/recruitment-officer-') {
        return RECRUITMENT_OFFICER_DETAIL_HTML
      }
      if (url === 'https://www.orbitouch-hr.com/jobs/dot-net-developer') {
        return DOT_NET_DEVELOPER_DETAIL_HTML
      }
      if (url === 'https://www.orbitouch-hr.com/jobs/business-development-manager---international-sales') {
        return BUSINESS_DEVELOPMENT_DETAIL_HTML
      }
      if (url === 'https://www.orbitouch-hr.com/jobs/project-manager-%E2%80%93-network-transformation') {
        return PROJECT_MANAGER_DETAIL_HTML
      }

      throw new Error(`Unexpected OrbiTouch URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    orbitouch.JOBS_URL,
    'https://www.orbitouch-hr.com/jobs/recruitment-officer-',
    'https://www.orbitouch-hr.com/jobs/dot-net-developer',
    'https://www.orbitouch-hr.com/jobs/business-development-manager---international-sales',
    'https://www.orbitouch-hr.com/jobs/project-manager-%E2%80%93-network-transformation',
  ])
  assert.equal(jobs.length, 4)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.city, job.employmentType, job.workModel, job.source, job.link, job.scrapedAt]),
    [
      [
        'Recruitment Officer',
        'Pune',
        'Full-time',
        'Onsite',
        'orbitouch',
        'https://www.orbitouch-hr.com/jobs/recruitment-officer-',
        FIXED_SCRAPED_AT,
      ],
      [
        'Dot Net Developer',
        'Chennai',
        'Full-time',
        'Hybrid',
        'orbitouch',
        'https://www.orbitouch-hr.com/jobs/dot-net-developer',
        FIXED_SCRAPED_AT,
      ],
      [
        'Business Development Manager - International Sales',
        'Mumbai',
        'Full-time',
        'Remote',
        'orbitouch',
        'https://www.orbitouch-hr.com/jobs/business-development-manager---international-sales',
        FIXED_SCRAPED_AT,
      ],
      [
        'Project Manager – Network Transformation',
        'Noida',
        'Contract',
        'Onsite',
        'orbitouch',
        'https://www.orbitouch-hr.com/jobs/project-manager-%E2%80%93-network-transformation',
        FIXED_SCRAPED_AT,
      ],
    ],
  )
  assert.equal(jobs[0].minimumQualification, 'Graduate')
  assert.equal(jobs[3].experienceRequired, '10 years')
})

test('OrbiTouch fails closed when the verified official jobs board no longer matches the trusted first-party surface', async () => {
  const orbitouch = await loadOrbiTouchModule()

  await assert.rejects(
    orbitouch.createOrbiTouchScraper().run({
      fetchText: async () => '<html><body><h1>Jobs</h1></body></html>',
    }),
    /official jobs board/i,
  )
})
