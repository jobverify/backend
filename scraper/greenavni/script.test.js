import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <main>
        <a href="https://www.greenavni.com/about/">About</a>
        <a href="https://www.greenavni.com/careers/">Energy Career Opportunities</a>
        <a href="https://www.greenavni.com/contact/">Contact</a>
        <h1>Green Avni Solutions LLP | Energy Management and Sustainability Partner</h1>
        <p>Serving our clients to achieve their ESG goals is our core business.</p>
        <p>Green Avni team comprises passionate and motivated sustainability professionals.</p>
        <p>We provide comprehensive energy and sustainability management solutions for our clients globally through our Center-of-Excellence team based out of Hyderabad, India.</p>
      </main>
    </body>
  </html>
`

const aboutHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <main>
        <h1>About</h1>
        <p>After 15+ years in the USA, Pavani and Prakash relocated from Boston to Hyderabad and founded ‘Green Avni Solutions, LLP’ in March 2019.</p>
        <p>Green Avni Solutions primary focus is to being support for US and international energy management firms.</p>
      </main>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <main>
        <h1>Energy Career Opportunities</h1>
        <p>We are hiring for the following energy job opportunities, based out of our office in Hyderabad, India.</p>
        <p>Qualified candidates are encouraged to apply directly by sending your resume and cover letter to hr@greenavni.com.</p>
        <h2>Open Positions</h2>
        <a href="https://www.greenavni.com/open-positions/">Energy Engineer – I</a>
        <a href="https://www.greenavni.com/open-positions/">Renewable Energy Engineer</a>
      </main>
    </body>
  </html>
`

const jobsHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <main>
        <h1>Job Opportunities</h1>
        <p>Company Description</p>
        <p>Green Avni Solutions, LLP provides comprehensive data-driven energy management services and clean energy solutions to commercial, institutional and industrial clients.</p>
        <p>Email your resume and cover letter to hr@greenavni.com if you see yourself in any of the below described roles.</p>

        <p>Energy Engineer – I/Energy Engineer Analyst</p>
        <p>Must Qualifications:</p>
        <p>M. TECH graduates (specialization in one of Thermal Energy, Energy/Power Systems, HVAC/R & Controls) with Undergrad in Mechanical/Electrical Engineering background only.</p>
        <p>Role Description:</p>
        <p>This is a full-time on-site Energy Engineer job opportunity based in Hyderabad.</p>
        <p>Key Responsibilities:</p>
        <ul>
          <li>Conduct energy audits and retro-commissioning activities.</li>
          <li>Perform energy modeling and calculate preliminary to detailed energy savings analyses.</li>
        </ul>
        <p>Required Qualifications</p>
        <p>Technical Skills: Must have at least 1 year of practical and relevant experience in any or combination of: energy modeling, Renewable energy systems, etc.</p>
        <p>Job Type: Full-time: Performance-based Full-time employment: Gross ₹420,000 – ₹440,000 per year + Benefits.</p>
        <p>Schedule and Reporting Place: Day shift • Gachibowli, Hyderabad -500032, Telangana</p>

        <h2>Renewable Energy Engineer</h2>
        <p>Must Qualifications:</p>
        <p>Recent M. TECH graduates (Mechanical or Electrical – with specialization in one of Renewable Energy, Energy Systems, Power Engineering, OR Thermal).</p>
        <p>Role Description:</p>
        <p>This is a full-time on-site Renewable Energy Engineer job opportunity based in Hyderabad.</p>
        <p>Key Responsibilities:</p>
        <ul>
          <li>Design and review layout of solar, wind, and other renewable/distributed energy assets.</li>
          <li>Work extensively with PVsyst, Helioscope, AutoCAD and other modelling software packages.</li>
        </ul>
        <p>Required Qualifications</p>
        <p>Analytical Skills: Strong knowledge on PVSYST, Helioscope, Homer, DER-CAM/VET, EnergyPlus.</p>
        <p>Job Type: Full-time: Performance-based Full-time employment: Gross ₹420,000 – ₹440,000 per year + Benefits.</p>
        <p>Schedule and Reporting Place: Day shift • Gachibowli, Hyderabad -500032, Telangana</p>
      </main>
    </body>
  </html>
`

test('Green Avni scraper validates the verified homepage, about page, careers page, and jobs page', async () => {
  const greenavni = await loadModule()
  assert.ok(greenavni, 'Green Avni scraper module should load')

  assert.equal(greenavni.SOURCE, 'greenavni')
  assert.equal(greenavni.COMPANY, 'Green Avni Solutions LLP')
  assert.equal(greenavni.HOMEPAGE_URL, 'https://www.greenavni.com/')
  assert.equal(greenavni.ABOUT_URL, 'https://www.greenavni.com/about/')
  assert.equal(greenavni.CAREERS_URL, 'https://www.greenavni.com/careers/')
  assert.equal(greenavni.JOBS_URL, 'https://www.greenavni.com/open-positions/')
  assert.equal(greenavni.APPLY_EMAIL, 'hr@greenavni.com')
  assert.equal(greenavni.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(greenavni.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(greenavni.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(greenavni.hasOfficialJobsPageSignal(jobsHtml), true)
})

test('Green Avni scraper extracts the public first-party roles with a shared mailto apply handoff', async () => {
  const greenavni = await loadModule()
  assert.ok(greenavni, 'Green Avni scraper module should load')

  const jobs = greenavni.extractJobs(jobsHtml)
  assert.equal(jobs.length, 2)

  assert.deepEqual(jobs[0], {
    title: 'Energy Engineer – I/Energy Engineer Analyst',
    company: 'Green Avni Solutions LLP',
    department: null,
    location: 'Gachibowli, Hyderabad -500032, Telangana',
    city: 'Hyderabad',
    state: 'Telangana',
    country: 'India',
    jobId: 'greenavni-energy-engineer-i-energy-engineer-analyst',
    requisitionId: 'greenavni-energy-engineer-i-energy-engineer-analyst',
    sourceUrl: 'https://www.greenavni.com/open-positions/',
    applyUrl: 'mailto:hr@greenavni.com',
    employmentType: 'Full-time',
    experienceRequired: 'At least 1 year',
    minimumQualification: 'M. TECH graduates (specialization in one of Thermal Energy, Energy/Power Systems, HVAC/R & Controls) with Undergrad in Mechanical/Electrical Engineering background only.',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'This is a full-time on-site Energy Engineer job opportunity based in Hyderabad.\nConduct energy audits and retro-commissioning activities.\nPerform energy modeling and calculate preliminary to detailed energy savings analyses.',
    remoteStatus: 'On-site',
  })

  assert.equal(jobs[1].title, 'Renewable Energy Engineer')
  assert.equal(jobs[1].company, 'Green Avni Solutions LLP')
  assert.equal(jobs[1].applyUrl, 'mailto:hr@greenavni.com')
  assert.equal(jobs[1].employmentType, 'Full-time')
  assert.equal(jobs[1].city, 'Hyderabad')
  assert.equal(jobs[1].state, 'Telangana')
})

test('Green Avni run returns stamped jobs only while the verified first-party surface stays intact', async () => {
  const greenavni = await loadModule()
  assert.ok(greenavni, 'Green Avni scraper module should load')

  const requestedUrls = []
  const jobs = await greenavni.createGreenAvniScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === greenavni.HOMEPAGE_URL) return homepageHtml
      if (url === greenavni.ABOUT_URL) return aboutHtml
      if (url === greenavni.CAREERS_URL) return careersHtml
      if (url === greenavni.JOBS_URL) return jobsHtml
      throw new Error(`Unexpected Green Avni URL: ${url}`)
    },
    now: () => '2026-07-12T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://www.greenavni.com/',
    'https://www.greenavni.com/about/',
    'https://www.greenavni.com/careers/',
    'https://www.greenavni.com/open-positions/',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'greenavni')
  assert.equal(jobs[0].link, 'mailto:hr@greenavni.com')
  assert.equal(jobs[0].scrapedAt, '2026-07-12T00:00:00.000Z')
})

test('Green Avni fails closed when the trusted pages drift or the shared apply mailbox disappears', async () => {
  const greenavni = await loadModule()
  assert.ok(greenavni, 'Green Avni scraper module should load')

  await assert.rejects(
    greenavni.createGreenAvniScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected homepage</h1></body></html>',
    }),
    /verified homepage/i,
  )

  await assert.rejects(
    greenavni.createGreenAvniScraper().run({
      fetchText: async (url) => {
        if (url === greenavni.HOMEPAGE_URL) return homepageHtml
        if (url === greenavni.ABOUT_URL) return aboutHtml
        if (url === greenavni.CAREERS_URL) return careersHtml
        return jobsHtml.replaceAll('hr@greenavni.com', 'hello@greenavni.com')
      },
    }),
    /shared apply mailbox/i,
  )
})
