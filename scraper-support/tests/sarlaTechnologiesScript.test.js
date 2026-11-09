import assert from 'node:assert/strict'
import test from 'node:test'

const CURRENT_OPENINGS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers at Sarla Technologies | Explore Current Job Openings</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <p>Advance your career with the best openings at Sarla Technologies.</p>
      <article class="job-card">
        <h4>SICAM Engineer (Substation Automation)</h4>
        <p>Qualification: B.E./B. Tech. in Electrical Engineering</p>
        <p>Experience: 4+ years</p>
        <a href="https://sarlatech.com/job/sicam-engineer-substation-automation/">Apply Now</a>
      </article>
      <article class="job-card">
        <h4>SCMS Engineer</h4>
        <p>Qualification: B.E./B. Tech in Electrical Engineering</p>
        <p>Experience: 4+ years</p>
        <a href="https://sarlatech.com/job/scms-engineer/">Apply Now</a>
      </article>
      <article class="job-card">
        <h4>Project Engineer/Sr. Project Engineer- Ignition Developer</h4>
        <p>Qualification: B.E./B.Tech / MCA with experience in Ignition based SCADA software system development</p>
        <p>Experience: 2 to 8 years</p>
        <a href="https://sarlatech.com/job/project-engineer-sr-project-engineer-ignition-developer/">Apply Now</a>
      </article>
      <article class="job-card">
        <h4>Business Development Executive (US region)</h4>
        <p>Qualification: BE Instrumentation / BSc / MBA / BMS / Diploma in Business Management</p>
        <p>Experience: 2 to 5 years</p>
        <a href="https://sarlatech.com/job/business-development-executive-us-region/">Apply Now</a>
      </article>
    </main>
  </body>
</html>
`

const SICAM_DETAIL_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>SICAM Engineer (Substation Automation) - Sarla Technologies</title>
  </head>
  <body>
    <main>
      <h1>SICAM Engineer (Substation Automation)</h1>
      <p>Qualification: B.E./B. Tech. in Electrical Engineering</p>
      <p>Experience: 4+ years</p>
      <p>Designation: Engineer / Senior Engineer</p>
      <p>Base Location: Navi Mumbai/Pune</p>
      <p>Travel: 60 to 70%</p>
      <section>
        <h2>Job Role/Responsibilities</h2>
        <ul>
          <li>Engineering and commissioning for IEC61850 based substation automation projects.</li>
          <li>Testing and FAT support for substation automation systems.</li>
        </ul>
      </section>
      <section>
        <h2>Requirement</h2>
        <ul>
          <li>IEC61850 engineering</li>
          <li>SICAM PAS / SICAM SCC exposure</li>
        </ul>
      </section>
      <a href="https://sarlatech.com/job/sicam-engineer-substation-automation/">Apply Now</a>
    </main>
  </body>
</html>
`

const SCMS_DETAIL_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>SCMS Engineer - Sarla Technologies</title>
  </head>
  <body>
    <main>
      <h1>SCMS Engineer</h1>
      <p>Qualification: B.E./B. Tech in Electrical Engineering</p>
      <p>Experience: 4+ years</p>
      <p>Designation: Engineer / Senior Engineer</p>
      <p>Base Location: UAE</p>
      <section>
        <h2>Job Role/Responsibilities</h2>
        <ul>
          <li>Substation control and monitoring system engineering.</li>
        </ul>
      </section>
      <section>
        <h2>Requirement</h2>
        <ul>
          <li>SCMS integration</li>
        </ul>
      </section>
      <a href="https://sarlatech.com/job/scms-engineer/">Apply Now</a>
    </main>
  </body>
</html>
`

const IGNITION_DETAIL_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Project Engineer/Sr. Project Engineer- Ignition Developer - Sarla Technologies</title>
  </head>
  <body>
    <main>
      <h1>Project Engineer/Sr. Project Engineer- Ignition Developer</h1>
      <p>Qualification: B.E./B.Tech / MCA with experience in Ignition based SCADA software system development</p>
      <p>Experience: 2 to 8 years</p>
      <p>Designation: Project Engineer / Senior Project Engineer</p>
      <p>Base Location: Navi Mumbai/Pune</p>
      <section>
        <h2>Job Role/Responsibilities</h2>
        <ul>
          <li>Ignition based SCADA software system development.</li>
          <li>Commissioning support for industrial automation projects.</li>
        </ul>
      </section>
      <section>
        <h2>Requirement</h2>
        <ul>
          <li>Ignition platform</li>
          <li>SCADA software development</li>
        </ul>
      </section>
      <a href="https://sarlatech.com/job/project-engineer-sr-project-engineer-ignition-developer/">Apply Now</a>
    </main>
  </body>
</html>
`

const US_REGION_DETAIL_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Business Development Executive (US region) - Sarla Technologies</title>
  </head>
  <body>
    <main>
      <h1>Business Development Executive (US region)</h1>
      <p>Qualification: BE Instrumentation / BSc / MBA / BMS / Diploma in Business Management</p>
      <p>Experience: 2 to 5 years</p>
      <p>Designation: Executive</p>
      <p>Job location: Navi Mumbai</p>
      <section>
        <h2>Job Role/Responsibilities</h2>
        <ul>
          <li>Lead generation and outbound prospecting for the US market.</li>
        </ul>
      </section>
      <section>
        <h2>Skill sets</h2>
        <ul>
          <li>Inside sales</li>
          <li>CRM discipline</li>
        </ul>
      </section>
      <a href="https://sarlatech.com/job/business-development-executive-us-region/">Apply Now</a>
    </main>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/sarlatechnologies/script.js')
  } catch {
    assert.fail('Expected Sarla Technologies scraper module at ../../scraper/sarlatechnologies/script.js')
  }
}

test('Sarla Technologies helpers stay pinned to the verified current openings page and first-party detail page contract', async () => {
  const sarla = await loadScriptModule()

  assert.equal(sarla.SOURCE, 'sarlatechnologies')
  assert.equal(sarla.COMPANY, 'Sarla Technologies')
  assert.equal(sarla.OFFICIAL_BRAND_NAME, 'Sarla Technologies')
  assert.equal(sarla.VERIFIED_ON, '2026-07-17')
  assert.equal(sarla.HOMEPAGE_URL, 'https://sarlatech.com/')
  assert.equal(sarla.CAREER_LANDING_PAGE_URL, 'https://sarlatech.com/career/')
  assert.equal(sarla.CURRENT_OPENINGS_URL, 'https://sarlatech.com/career/current-openings/')
  assert.equal(sarla.hasOfficialCurrentOpeningsSignal(CURRENT_OPENINGS_HTML), true)
  assert.equal(sarla.hasOfficialJobDetailSignal(SICAM_DETAIL_HTML), true)
  assert.deepEqual(
    sarla.extractListings(CURRENT_OPENINGS_HTML).map((job) => ({
      title: job.title,
      minimumQualification: job.minimumQualification,
      experienceRequired: job.experienceRequired,
      sourceUrl: job.sourceUrl,
    })),
    [
      {
        title: 'SICAM Engineer (Substation Automation)',
        minimumQualification: 'B.E./B. Tech. in Electrical Engineering',
        experienceRequired: '4+ years',
        sourceUrl: 'https://sarlatech.com/job/sicam-engineer-substation-automation/',
      },
      {
        title: 'SCMS Engineer',
        minimumQualification: 'B.E./B. Tech in Electrical Engineering',
        experienceRequired: '4+ years',
        sourceUrl: 'https://sarlatech.com/job/scms-engineer/',
      },
      {
        title: 'Project Engineer/Sr. Project Engineer- Ignition Developer',
        minimumQualification: 'B.E./B.Tech / MCA with experience in Ignition based SCADA software system development',
        experienceRequired: '2 to 8 years',
        sourceUrl: 'https://sarlatech.com/job/project-engineer-sr-project-engineer-ignition-developer/',
      },
      {
        title: 'Business Development Executive (US region)',
        minimumQualification: 'BE Instrumentation / BSc / MBA / BMS / Diploma in Business Management',
        experienceRequired: '2 to 5 years',
        sourceUrl: 'https://sarlatech.com/job/business-development-executive-us-region/',
      },
    ],
  )

  const indiaDetail = sarla.extractJobDetail(SICAM_DETAIL_HTML, sarla.extractListings(CURRENT_OPENINGS_HTML)[0])
  assert.equal(indiaDetail.location, 'Navi Mumbai/Pune, India')
  assert.equal(indiaDetail.city, 'Navi Mumbai')
  assert.equal(indiaDetail.country, 'India')
  assert.deepEqual(indiaDetail.requiredSkills, ['IEC61850 engineering', 'SICAM PAS / SICAM SCC exposure'])
})

test('Sarla Technologies run returns only the verified India-based roles from first-party detail pages', async () => {
  const sarla = await loadScriptModule()
  const requestedUrls = []

  const jobs = await sarla.createSarlaTechnologiesScraper({
    now: () => '2026-07-17T10:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === sarla.CURRENT_OPENINGS_URL) return CURRENT_OPENINGS_HTML
      if (url === 'https://sarlatech.com/job/sicam-engineer-substation-automation/') return SICAM_DETAIL_HTML
      if (url === 'https://sarlatech.com/job/scms-engineer/') return SCMS_DETAIL_HTML
      if (url === 'https://sarlatech.com/job/project-engineer-sr-project-engineer-ignition-developer/') return IGNITION_DETAIL_HTML
      if (url === 'https://sarlatech.com/job/business-development-executive-us-region/') return US_REGION_DETAIL_HTML
      throw new Error(`Unexpected Sarla Technologies URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    sarla.CURRENT_OPENINGS_URL,
    'https://sarlatech.com/job/sicam-engineer-substation-automation/',
    'https://sarlatech.com/job/scms-engineer/',
    'https://sarlatech.com/job/project-engineer-sr-project-engineer-ignition-developer/',
    'https://sarlatech.com/job/business-development-executive-us-region/',
  ])

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      country: job.country,
      minimumQualification: job.minimumQualification,
      experienceRequired: job.experienceRequired,
      sourceUrl: job.sourceUrl,
      link: job.link,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'SICAM Engineer (Substation Automation)',
        location: 'Navi Mumbai/Pune, India',
        country: 'India',
        minimumQualification: 'B.E./B. Tech. in Electrical Engineering',
        experienceRequired: '4+ years',
        sourceUrl: 'https://sarlatech.com/job/sicam-engineer-substation-automation/',
        link: 'https://sarlatech.com/job/sicam-engineer-substation-automation/',
        scrapedAt: '2026-07-17T10:00:00.000Z',
      },
      {
        title: 'Project Engineer/Sr. Project Engineer- Ignition Developer',
        location: 'Navi Mumbai/Pune, India',
        country: 'India',
        minimumQualification: 'B.E./B.Tech / MCA with experience in Ignition based SCADA software system development',
        experienceRequired: '2 to 8 years',
        sourceUrl: 'https://sarlatech.com/job/project-engineer-sr-project-engineer-ignition-developer/',
        link: 'https://sarlatech.com/job/project-engineer-sr-project-engineer-ignition-developer/',
        scrapedAt: '2026-07-17T10:00:00.000Z',
      },
      {
        title: 'Business Development Executive (US region)',
        location: 'Navi Mumbai, India',
        country: 'India',
        minimumQualification: 'BE Instrumentation / BSc / MBA / BMS / Diploma in Business Management',
        experienceRequired: '2 to 5 years',
        sourceUrl: 'https://sarlatech.com/job/business-development-executive-us-region/',
        link: 'https://sarlatech.com/job/business-development-executive-us-region/',
        scrapedAt: '2026-07-17T10:00:00.000Z',
      },
    ],
  )
})

test('Sarla Technologies fails closed when the verified current openings or detail surfaces drift', async () => {
  const sarla = await loadScriptModule()

  await assert.rejects(
    sarla.createSarlaTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === sarla.CURRENT_OPENINGS_URL) return '<html><body><h1>Jobs</h1></body></html>'
        throw new Error(`Unexpected Sarla Technologies URL: ${url}`)
      },
    }),
    /verified current openings page/i,
  )

  await assert.rejects(
    sarla.createSarlaTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === sarla.CURRENT_OPENINGS_URL) return CURRENT_OPENINGS_HTML
        return '<html><body><h1>Unexpected detail</h1></body></html>'
      },
    }),
    /verified first-party job detail page/i,
  )
})
