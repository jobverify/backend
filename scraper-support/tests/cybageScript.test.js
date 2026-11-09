import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Open Positions (Careers): Cybage</title>
    <link rel="canonical" href="https://www.cybage.com/careers/open-positions" />
  </head>
  <body>
    <h1>Open Positions</h1>
    <p>Current Openings</p>
    <table class="jobs-table">
      <tbody>
        <tr>
          <td><a href="/careers/open-positions/current-openings/senior-net-developer">Senior .NET Developer</a></td>
          <td>Pune, India</td>
          <td>4-8 years</td>
        </tr>
        <tr>
          <td><a href="/careers/open-positions/current-openings/lead-qa-automation-engineer">Lead QA Automation Engineer</a></td>
          <td>Hyderabad, India</td>
          <td>6-10 years</td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`

const currentCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Open Positions (Careers): Cybage</title>
    <link rel="canonical" href="https://www.cybage.com/careers/open-positions" />
  </head>
  <body class="post-type-archive-jobpost">
    <h1>Open Positions</h1>
    <span class="result-summary">9 Results</span>
    <div class="table-responsive">
      <table class="table table-hover table-striped views-table views-view-table cols-4 sticky-enabled">
        <tbody>
          <tr>
            <td class="views-field views-field-title"><a href="/careers/open-positions/current-openings/cyber-security-operations-analyst">Cyber Security Operations Analyst</a></td>
            <td class="views-field views-field-field-department">Engineering</td>
            <td class="views-field views-field-field-location">Pune</td>
            <td class="views-field views-field-field-work-experience">6+ years</td>
          </tr>
          <tr>
            <td class="views-field views-field-title"><a href="/careers/open-positions/current-openings/senior-net-developer">Senior .Net Developer</a></td>
            <td class="views-field views-field-field-department">Engineering</td>
            <td class="views-field views-field-field-location">Pune</td>
            <td class="views-field views-field-field-work-experience">8 to 12 years</td>
          </tr>
        </tbody>
      </table>
    </div>
  </body>
</html>
`

const currentDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Cyber Security Operations Analyst | Cybage</title>
    <link rel="canonical" href="https://www.cybage.com/careers/open-positions/current-openings/cyber-security-operations-analyst" />
  </head>
  <body>
    <h1 class="display-3 mb-3"> Job Description </h1>
    <div class="job_details">
      <div class="job_info">
        <h4 class="job_info__heading">Job Title</h4>
        <div class="job_info__desc"><span class="field field--name-title field--type-string field--label-hidden">Cyber Security Operations Analyst</span></div>
      </div>
      <div class="job_info">
        <h4 class="job_info__heading">Department</h4>
        <div class="job_info__desc">Engineering</div>
      </div>
      <div class="job_info">
        <h4 class="job_info__heading">Location</h4>
        <div class="job_info__desc">Pune</div>
      </div>
      <div class="job_info">
        <h4 class="job_info__heading">Work Experience</h4>
        <div class="job_info__desc">6+ years</div>
      </div>
      <div class="mt-link cybage-link-button apply_now">
        <a href="https://careers.cybage.com/PublicPages/UserLogin.aspx" target="_blank" class="btn-colour-first">Apply Now</a>
      </div>
    </div>
    <div class="job-description">
      <div class="about-position" id="about-the-position">
        <h4>About The Position</h4>
        <div><p>The Senior Security Operations Analyst will be responsible for monitoring security alerts and investigating incidents.</p></div>
      </div>
      <div class="job_requirement">
        <div id="technical-and-professional-requirements">
          <h4>Technical and Professional Requirements</h4>
          <div><p>Experience in SIEM tooling and security operations.</p></div>
        </div>
      </div>
    </div>
  </body>
</html>
`

const detailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Senior .NET Developer | Cybage</title>
  </head>
  <body>
    <h1>Senior .NET Developer</h1>
    <div class="job-meta">
      <span>Location: Pune, India</span>
      <span>Experience: 4-8 years</span>
    </div>
    <div class="job-description">
      <p>Build and maintain enterprise .NET applications for global clients.</p>
      <p>Collaborate with QA and product teams on delivery quality.</p>
    </div>
    <a class="apply-now" href="https://careers.cybage.com/PublicPages/UserLogin.aspx">Apply Now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/cybage/script.js')
  } catch {
    assert.fail('Expected Cybage scraper module at ../../scraper/cybage/script.js')
  }
}

test('Cybage validates the verified first-party open positions page', async () => {
  const cybage = await loadModule()

  assert.equal(cybage.SOURCE, 'cybage')
  assert.equal(cybage.COMPANY, 'Cybage')
  assert.equal(cybage.CAREERS_URL, 'https://www.cybage.com/careers/open-positions')
  assert.equal(cybage.APPLY_LOGIN_URL, 'https://careers.cybage.com/PublicPages/UserLogin.aspx')
  assert.equal(cybage.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(cybage.hasOfficialCareersSignal(currentCareersHtml), true)
})

test('Cybage extracts the verified first-party jobs table into listing records', async () => {
  const cybage = await loadModule()
  const listings = cybage.extractListings(careersHtml)

  assert.equal(listings.length, 2)
  assert.deepEqual(listings[0], {
    title: 'Senior .NET Developer',
    company: 'Cybage',
    department: null,
    location: 'Pune, India',
    city: 'Pune',
    country: 'India',
    jobId: 'senior-net-developer',
    requisitionId: 'senior-net-developer',
    sourceUrl: 'https://www.cybage.com/careers/open-positions/current-openings/senior-net-developer',
    applyUrl: 'https://www.cybage.com/careers/open-positions/current-openings/senior-net-developer',
    employmentType: null,
    experienceRequired: '4-8 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
})

test('Cybage accepts the current Drupal jobs table and detail cards', async () => {
  const cybage = await loadModule()
  const listings = cybage.extractListings(currentCareersHtml)

  assert.equal(listings.length, 2)
  assert.deepEqual(listings[0], {
    title: 'Cyber Security Operations Analyst',
    company: 'Cybage',
    department: 'Engineering',
    location: 'Pune, India',
    city: 'Pune',
    country: 'India',
    jobId: 'cyber-security-operations-analyst',
    requisitionId: 'cyber-security-operations-analyst',
    sourceUrl: 'https://www.cybage.com/careers/open-positions/current-openings/cyber-security-operations-analyst',
    applyUrl: 'https://www.cybage.com/careers/open-positions/current-openings/cyber-security-operations-analyst',
    employmentType: null,
    experienceRequired: '6+ years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })

  const detail = cybage.extractJobDetail(currentDetailHtml, listings[0])
  assert.equal(detail.title, 'Cyber Security Operations Analyst')
  assert.equal(detail.department, 'Engineering')
  assert.equal(detail.location, 'Pune, India')
  assert.equal(detail.applyUrl, 'https://careers.cybage.com/PublicPages/UserLogin.aspx')
  assert.match(detail.jobDescription, /monitoring security alerts/i)
})

test('Cybage detail parsing keeps the ASP.NET login handoff as the apply URL', async () => {
  const cybage = await loadModule()
  const detail = cybage.extractJobDetail(detailHtml, {
    title: 'Senior .NET Developer',
    company: 'Cybage',
    department: null,
    location: 'Pune, India',
    city: 'Pune',
    country: 'India',
    jobId: 'senior-net-developer',
    requisitionId: 'senior-net-developer',
    sourceUrl: 'https://www.cybage.com/careers/open-positions/current-openings/senior-net-developer',
    applyUrl: 'https://www.cybage.com/careers/open-positions/current-openings/senior-net-developer',
    employmentType: null,
    experienceRequired: '4-8 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })

  assert.deepEqual(detail, {
    title: 'Senior .NET Developer',
    company: 'Cybage',
    department: null,
    location: 'Pune, India',
    city: 'Pune',
    country: 'India',
    jobId: 'senior-net-developer',
    requisitionId: 'senior-net-developer',
    sourceUrl: 'https://www.cybage.com/careers/open-positions/current-openings/senior-net-developer',
    applyUrl: 'https://careers.cybage.com/PublicPages/UserLogin.aspx',
    employmentType: null,
    experienceRequired: '4-8 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription:
      'Build and maintain enterprise .NET applications for global clients. Collaborate with QA and product teams on delivery quality.',
  })
})

test('Cybage run validates the verified first-party flow and decorates jobs', async () => {
  const cybage = await loadModule()
  const requestedUrls = []

  const jobs = await cybage.createCybageScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === cybage.CAREERS_URL) return careersHtml
      if (url === 'https://www.cybage.com/careers/open-positions/current-openings/senior-net-developer') {
        return detailHtml
      }

      throw new Error(`Unexpected Cybage fixture URL: ${url}`)
    },
    now: () => '2026-07-14T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    cybage.CAREERS_URL,
    'https://www.cybage.com/careers/open-positions/current-openings/senior-net-developer',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'cybage')
  assert.equal(jobs[0].company, 'Cybage')
  assert.equal(jobs[0].jobId, 'senior-net-developer')
  assert.equal(jobs[0].link, 'https://careers.cybage.com/PublicPages/UserLogin.aspx')
  assert.equal(jobs[0].scrapedAt, '2026-07-14T00:00:00.000Z')
})

test('Cybage fails closed when the verified jobs table or detail contract drifts', async () => {
  const cybage = await loadModule()

  await assert.rejects(
    cybage.createCybageScraper().run({
      fetchText: async () => '<html><body><h1>Open Positions</h1></body></html>',
    }),
    /verified official open positions surface/i,
  )

  await assert.rejects(
    cybage.createCybageScraper({ maxJobs: 1 }).run({
      fetchText: async (url) => {
        if (url === cybage.CAREERS_URL) return careersHtml
        return '<html><body><h1>Broken</h1></body></html>'
      },
    }),
    /verified first-party detail page/i,
  )
})
