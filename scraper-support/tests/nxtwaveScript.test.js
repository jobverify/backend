import assert from 'node:assert/strict'
import test from 'node:test'

const loadNxtWaveModule = async () => {
  try {
    return await import('../../scraper/nxtwave/script.js')
  } catch (error) {
    assert.fail(`Expected NxtWave scraper module at ../../scraper/nxtwave/script.js (${error.code || error.message})`)
  }
}

const listingHtml = `
<!doctype html>
<html>
  <body>
    <section class="job-group">
      <h5>Business Development</h5>
      <a class="job-card" href="/jobs/HnNBo3RbImcf/associate-project-manager">
        Associate Project Manager
      </a>
      <a class="job-card" href="/jobs/xA12Bc34De56/business-development-associate-work-from-home">
        Business Development Associate - Work From Home
      </a>
    </section>
    <section class="job-group">
      <h5>Technical</h5>
      <a class="job-card" href="/jobs/IZM4QfSpBhtB/full-stack-developer-2">
        Full Stack Developer - 2
      </a>
    </section>
  </body>
</html>
`

const associateProjectManagerDetailHtml = `
<!doctype html>
<html>
  <body>
    <div class="job-department">Business Development</div>
    <h1>Associate Project Manager</h1>
    <div class="job-meta">Hyderabad, Telangana | Full Time</div>
    <a class="apply-button" href="#job-application">Apply Now</a>
    <div class="job-body">
      <h3>About NxtWave</h3>
      <p>NxtWave is one of India's fastest-growing Ed-Tech startups.</p>
      <h3>Job Summary</h3>
      <p>Support the smooth planning and execution of assessments across learner cohorts.</p>
      <h3>Preferred Skills &amp; Qualifications</h3>
      <ul>
        <li>1-2 years of experience in operations, academic support, or program coordination roles.</li>
        <li>Strong communication, coordination, and documentation skills.</li>
      </ul>
      <p>Location: Hyderabad</p>
    </div>
    <h3>Submit Your Application</h3>
  </body>
</html>
`

const remoteBusinessDevelopmentDetailHtml = `
<!doctype html>
<html>
  <body>
    <div class="job-department">Business Development</div>
    <h1>Business Development Associate - Work From Home</h1>
    <div class="job-meta">Remote | Full Time</div>
    <a class="apply-button" href="#job-application">Apply Now</a>
    <div class="job-body">
      <h3>Role Overview</h3>
      <p>Guide learners through career decisions from anywhere in India.</p>
      <h3>Qualifications</h3>
      <ul>
        <li>0-2 years of experience in inside sales, counseling, or edtech support.</li>
        <li>Comfortable working in a high-volume remote calling environment.</li>
      </ul>
    </div>
    <h3>Submit Your Application</h3>
  </body>
</html>
`

const fullStackDeveloperDetailHtml = `
<!doctype html>
<html>
  <body>
    <div class="job-department">Technical</div>
    <h1>Full Stack Developer - 2</h1>
    <div class="job-meta">Hyderabad, Telangana | Full Time</div>
    <a class="apply-button" href="#job-application">Apply Now</a>
    <div class="job-body">
      <h3>About NxtWave</h3>
      <p>NxtWave is transforming youth into highly skilled tech professionals through its CCBP 4.0 programs.</p>
      <h3>Responsibilities</h3>
      <ul>
        <li>Lead design and delivery of complex end-to-end features across frontend, backend, and data layers.</li>
        <li>Define and enforce comprehensive testing strategies: unit, integration, and end-to-end.</li>
      </ul>
      <h3>Qualifications &amp; Skills</h3>
      <ul>
        <li>3-5 years building production full stack applications end-to-end with measurable impact.</li>
        <li>Deep expertise in React with TypeScript and Node.js.</li>
      </ul>
      <p>Work Location: Hyderabad</p>
    </div>
    <h3>Submit Your Application</h3>
  </body>
</html>
`

test('NxtWave constants stay pinned to the official careers page, Freshteam board, and public detail URL pattern', async () => {
  const nxtwave = await loadNxtWaveModule()

  assert.equal(nxtwave.COMPANY_NAME, 'NxtWave')
  assert.equal(nxtwave.COUNTRY_FILTER, 'India')
  assert.equal(nxtwave.COMPANY_CAREERS_URL, 'https://www.ccbp.in/careers')
  assert.equal(nxtwave.LISTING_URL, 'https://nxtwave.freshteam.com/jobs')
  assert.equal(nxtwave.DETAIL_URL_PATTERN, 'https://nxtwave.freshteam.com/jobs/{opaque_id}/{slug}')
  assert.equal(
    nxtwave.buildDetailUrl('IZM4QfSpBhtB', 'full-stack-developer-2'),
    'https://nxtwave.freshteam.com/jobs/IZM4QfSpBhtB/full-stack-developer-2',
  )
  assert.equal(typeof nxtwave.extractListingJobs, 'function')
  assert.equal(typeof nxtwave.extractJobDetail, 'function')
  assert.equal(typeof nxtwave.extractSearchResults, 'function')
  assert.equal(typeof nxtwave.createNxtWaveScraper, 'function')
  assert.equal(typeof nxtwave.run, 'function')
})

test('extractSearchResults parses the Freshteam board and keeps each public detail page as the apply surface', async () => {
  const nxtwave = await loadNxtWaveModule()

  const jobs = nxtwave.extractSearchResults({
    listingHtml,
    detailHtmlByUrl: {
      'https://nxtwave.freshteam.com/jobs/HnNBo3RbImcf/associate-project-manager': associateProjectManagerDetailHtml,
      'https://nxtwave.freshteam.com/jobs/xA12Bc34De56/business-development-associate-work-from-home': remoteBusinessDevelopmentDetailHtml,
      'https://nxtwave.freshteam.com/jobs/IZM4QfSpBhtB/full-stack-developer-2': fullStackDeveloperDetailHtml,
    },
  })

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs[0], {
    title: 'Associate Project Manager',
    company: 'NxtWave',
    department: 'Business Development',
    location: 'Hyderabad, Telangana, India',
    city: 'Hyderabad',
    country: 'India',
    jobId: 'HnNBo3RbImcf',
    requisitionId: 'HnNBo3RbImcf',
    sourceUrl: 'https://nxtwave.freshteam.com/jobs/HnNBo3RbImcf/associate-project-manager',
    applyUrl: 'https://nxtwave.freshteam.com/jobs/HnNBo3RbImcf/associate-project-manager',
    employmentType: 'Full-time',
    experienceRequired: '1-2 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: [
      'About NxtWave',
      "NxtWave is one of India's fastest-growing Ed-Tech startups.",
      'Job Summary',
      'Support the smooth planning and execution of assessments across learner cohorts.',
      'Preferred Skills & Qualifications',
      '1-2 years of experience in operations, academic support, or program coordination roles.',
      'Strong communication, coordination, and documentation skills.',
      'Location: Hyderabad',
    ].join(' '),
    remoteStatus: 'On-site',
  })
  assert.deepEqual(jobs[1], {
    title: 'Business Development Associate - Work From Home',
    company: 'NxtWave',
    department: 'Business Development',
    location: 'Remote, India',
    city: null,
    country: 'India',
    jobId: 'xA12Bc34De56',
    requisitionId: 'xA12Bc34De56',
    sourceUrl: 'https://nxtwave.freshteam.com/jobs/xA12Bc34De56/business-development-associate-work-from-home',
    applyUrl: 'https://nxtwave.freshteam.com/jobs/xA12Bc34De56/business-development-associate-work-from-home',
    employmentType: 'Full-time',
    experienceRequired: '0-2 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: [
      'Role Overview',
      'Guide learners through career decisions from anywhere in India.',
      'Qualifications',
      '0-2 years of experience in inside sales, counseling, or edtech support.',
      'Comfortable working in a high-volume remote calling environment.',
    ].join(' '),
    remoteStatus: 'Remote',
  })
  assert.equal(jobs[2].title, 'Full Stack Developer - 2')
  assert.equal(jobs[2].department, 'Technical')
  assert.equal(jobs[2].jobId, 'IZM4QfSpBhtB')
  assert.equal(jobs[2].sourceUrl, 'https://nxtwave.freshteam.com/jobs/IZM4QfSpBhtB/full-stack-developer-2')
  assert.equal(jobs[2].applyUrl, 'https://nxtwave.freshteam.com/jobs/IZM4QfSpBhtB/full-stack-developer-2')
  assert.equal(jobs[2].location, 'Hyderabad, Telangana, India')
  assert.equal(jobs[2].employmentType, 'Full-time')
  assert.equal(jobs[2].experienceRequired, '3-5 years')
  assert.equal(jobs[2].remoteStatus, 'On-site')
  assert.match(jobs[2].jobDescription, /Lead design and delivery of complex end-to-end features/i)
  assert.match(jobs[2].jobDescription, /Deep expertise in React with TypeScript and Node\.js/i)
})

test('run fetches the NxtWave Freshteam board, enriches only the selected detail pages, and decorates jobs', async () => {
  const nxtwave = await loadNxtWaveModule()
  const requestedUrls = []

  const jobs = await nxtwave.createNxtWaveScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === nxtwave.LISTING_URL) return listingHtml
      if (url === 'https://nxtwave.freshteam.com/jobs/HnNBo3RbImcf/associate-project-manager') {
        return associateProjectManagerDetailHtml
      }
      if (url === 'https://nxtwave.freshteam.com/jobs/xA12Bc34De56/business-development-associate-work-from-home') {
        return remoteBusinessDevelopmentDetailHtml
      }

      throw new Error(`Unexpected NxtWave fixture URL: ${url}`)
    },
    now: () => '2026-07-10T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    nxtwave.LISTING_URL,
    'https://nxtwave.freshteam.com/jobs/HnNBo3RbImcf/associate-project-manager',
    'https://nxtwave.freshteam.com/jobs/xA12Bc34De56/business-development-associate-work-from-home',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'nxtwave')
  assert.equal(jobs[0].company, 'NxtWave')
  assert.equal(jobs[0].link, 'https://nxtwave.freshteam.com/jobs/HnNBo3RbImcf/associate-project-manager')
  assert.equal(jobs[0].scrapedAt, '2026-07-10T00:00:00.000Z')
  assert.equal(jobs[1].jobId, 'xA12Bc34De56')
  assert.equal(jobs[1].applyUrl, 'https://nxtwave.freshteam.com/jobs/xA12Bc34De56/business-development-associate-work-from-home')
  assert.equal(jobs[1].remoteStatus, 'Remote')
})
