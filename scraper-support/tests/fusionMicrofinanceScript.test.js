import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Fusion Finance Limited - NBFC | MFI Company</title>
  </head>
  <body>
    <header>
      <a href="https://fusionfin.com/">Home</a>
      <a href="https://fusionfin.com/about-us/">About Us</a>
      <a href="https://fusionfin.com/careers/">Careers</a>
      <a href="https://fusionfin.com/careers/">Current Openings</a>
    </header>
    <footer>
      <p>M/s Fusion Finance Limited (Formerly known as “Fusion Micro Finance Limited”).</p>
    </footer>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Fusion Finance – Microfinance Jobs, opportunities &amp; Careers</title>
    <link rel="canonical" href="https://fusionfin.com/careers/" />
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>Committed to fostering a workplace culture that values diversity, innovation and growth.</p>
      <h2>Current Openings</h2>
      <p>Click here to apply against open job postings</p>
      <p>
        Click here to apply for Area Manager, Branch Manager, Audit Officer &amp; Relationship Officer jobs at branches of Fusion Micro Finance Ltd.
      </p>

      <section class="featured-role">
        <a href="https://fusionfin.com/featuredjobs/qa-engineer-sr-qa-engineer/">QA Engineer/Sr. QA Engineer</a>
        <span>1-5</span>
        <span>Haryana</span>
        <span>Gurgaon/Gurugram</span>
        <span>Automation Testing</span>
        <a href="https://fusionfin.com/featuredjobs/qa-engineer-sr-qa-engineer/">More Details</a>
      </section>

      <form id="apply-now">
        <label for="job-title">Job Title</label>
        <select id="job-title" name="job_title">
          <option value="">Select The Job Title</option>
          <option value="mfi-relationship-officer">MFI - Relationship Officer</option>
          <option value="mfi-audit-officer">MFI - Audit Officer</option>
          <option value="mfi-branch-manager">MFI - Branch Manager</option>
          <option value="mfi-area-manager">MFI - Area Manager</option>
          <option value="msme-business-development-officer">MSME - Business Development Officer</option>
          <option value="msme-credit-officer">MSME - Credit Officer</option>
          <option value="msme-executive-operations">MSME - Executive Operations</option>
        </select>
        <label for="job-state">Job State</label>
        <select id="job-state" name="job_state">
          <option value="">Select State</option>
          <option>Haryana</option>
          <option>Delhi</option>
        </select>
        <label for="job-city">Job City</label>
        <select id="job-city" name="job_city">
          <option value="">Select City</option>
          <option>Gurgaon/Gurugram</option>
          <option>Delhi</option>
        </select>
        <button type="submit">Apply Now</button>
      </form>
    </main>
  </body>
</html>
`

const qaDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>QA Engineer/Sr. QA Engineer - Fusion Finance Limited</title>
    <link rel="canonical" href="https://fusionfin.com/featuredjobs/qa-engineer-sr-qa-engineer/" />
  </head>
  <body>
    <main>
      <h1>QA Engineer/Sr. QA Engineer</h1>
      <p>Experience: 1-5</p>
      <p>State: Haryana</p>
      <p>City: Gurgaon/Gurugram</p>
      <p>Job Role: Automation Testing</p>
      <div class="job-profile">
        <ul>
          <li>Design and execute automated test suites for digital lending systems.</li>
          <li>Collaborate with developers and product managers to triage defects.</li>
        </ul>
      </div>
      <p>Interested applicants can reach out to us at recruiter@fusionfin.com</p>
      <section id="apply">
        <h2>Apply for this position</h2>
        <form method="post">
          <input type="text" name="name" />
          <input type="file" name="resume" />
          <button type="submit">Apply Now</button>
        </form>
      </section>
    </main>
  </body>
</html>
`

const loadFusionMicrofinanceModule = async () => {
  try {
    return await import('../../scraper/fusionmicrofinance/script.js')
  } catch {
    assert.fail('Expected Fusion Microfinance scraper module at ../../scraper/fusionmicrofinance/script.js')
  }
}

test('Fusion Microfinance scraper constants and helpers stay pinned to the verified first-party careers surface', async () => {
  const fusionMicrofinance = await loadFusionMicrofinanceModule()

  assert.equal(fusionMicrofinance.SOURCE, 'fusionmicrofinance')
  assert.equal(fusionMicrofinance.COMPANY, 'Fusion Microfinance')
  assert.equal(fusionMicrofinance.OFFICIAL_BRAND_NAME, 'Fusion Finance')
  assert.equal(fusionMicrofinance.VERIFIED_ON, '2026-08-04')
  assert.equal(fusionMicrofinance.HOMEPAGE_URL, 'https://fusionfin.com/')
  assert.equal(fusionMicrofinance.CAREERS_URL, 'https://fusionfin.com/careers/')
  assert.equal(fusionMicrofinance.RECRUITER_EMAIL, 'recruiter@fusionfin.com')
  assert.deepEqual(fusionMicrofinance.GENERIC_JOB_TITLES, [
    'MFI - Relationship Officer',
    'MFI - Audit Officer',
    'MFI - Branch Manager',
    'MFI - Area Manager',
    'MSME - Business Development Officer',
    'MSME - Credit Officer',
    'MSME - Executive Operations',
  ])
  assert.deepEqual(fusionMicrofinance.FEATURED_ROLE_URLS, [
    'https://fusionfin.com/featuredjobs/qa-engineer-sr-qa-engineer/',
  ])
  assert.equal(fusionMicrofinance.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(fusionMicrofinance.hasOfficialCareersSurface(careersHtml), true)
  assert.equal(fusionMicrofinance.hasOfficialDetailPageSignal(qaDetailHtml), true)
  assert.deepEqual(fusionMicrofinance.extractGenericJobTitles(careersHtml), [
    'MFI - Relationship Officer',
    'MFI - Audit Officer',
    'MFI - Branch Manager',
    'MFI - Area Manager',
    'MSME - Business Development Officer',
    'MSME - Credit Officer',
    'MSME - Executive Operations',
  ])
  assert.deepEqual(fusionMicrofinance.extractFeaturedListings(careersHtml), [
    {
      title: 'QA Engineer/Sr. QA Engineer',
      experienceRequired: '1-5',
      state: 'Haryana',
      city: 'Gurgaon/Gurugram',
      department: 'Automation Testing',
      sourceUrl: 'https://fusionfin.com/featuredjobs/qa-engineer-sr-qa-engineer/',
    },
  ])
})

test('Fusion Microfinance extracts the verified first-party QA detail page into a normalized job', async () => {
  const fusionMicrofinance = await loadFusionMicrofinanceModule()
  const listing = fusionMicrofinance.extractFeaturedListings(careersHtml)[0]

  assert.deepEqual(fusionMicrofinance.extractFeaturedJobDetail(qaDetailHtml, listing), {
    title: 'QA Engineer/Sr. QA Engineer',
    company: 'Fusion Microfinance',
    department: 'Automation Testing',
    location: 'Gurgaon/Gurugram, Haryana, India',
    city: 'Gurgaon/Gurugram',
    state: 'Haryana',
    country: 'India',
    jobId: 'fusionmicrofinance-qa-engineer-sr-qa-engineer',
    requisitionId: 'fusionmicrofinance-qa-engineer-sr-qa-engineer',
    sourceUrl: 'https://fusionfin.com/featuredjobs/qa-engineer-sr-qa-engineer/',
    applyUrl: 'https://fusionfin.com/featuredjobs/qa-engineer-sr-qa-engineer/#apply',
    employmentType: null,
    experienceRequired: '1-5',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Design and execute automated test suites for digital lending systems.',
      'Collaborate with developers and product managers to triage defects.',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription:
      'Job Role: Automation Testing Design and execute automated test suites for digital lending systems. Collaborate with developers and product managers to triage defects. Interested applicants can reach out to us at recruiter@fusionfin.com',
    publicExperienceChecked: true,
    remoteStatus: 'On-site',
  })
})

test('run verifies the Fusion homepage and careers surface, then returns generic and featured first-party jobs', async () => {
  const fusionMicrofinance = await loadFusionMicrofinanceModule()
  const requestedUrls = []

  const jobs = await fusionMicrofinance.createFusionMicrofinanceScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === fusionMicrofinance.HOMEPAGE_URL) return homepageHtml
      if (url === fusionMicrofinance.CAREERS_URL) return careersHtml
      if (url === 'https://fusionfin.com/featuredjobs/qa-engineer-sr-qa-engineer/') return qaDetailHtml

      throw new Error(`Unexpected Fusion Microfinance URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://fusionfin.com/',
    'https://fusionfin.com/careers/',
    'https://fusionfin.com/featuredjobs/qa-engineer-sr-qa-engineer/',
  ])
  assert.equal(jobs.length, 8)
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'MFI - Relationship Officer',
      'MFI - Audit Officer',
      'MFI - Branch Manager',
      'MFI - Area Manager',
      'MSME - Business Development Officer',
      'MSME - Credit Officer',
      'MSME - Executive Operations',
      'QA Engineer/Sr. QA Engineer',
    ],
  )
  assert.deepEqual(jobs[0], {
    title: 'MFI - Relationship Officer',
    company: 'Fusion Microfinance',
    department: 'MFI',
    location: 'India',
    city: null,
    state: null,
    country: 'India',
    jobId: 'fusionmicrofinance-mfi-relationship-officer',
    requisitionId: 'fusionmicrofinance-mfi-relationship-officer',
    sourceUrl: 'https://fusionfin.com/careers/',
    applyUrl: 'https://fusionfin.com/careers/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Apply through the public first-party Fusion careers form.',
    publicExperienceChecked: true,
    remoteStatus: 'On-site',
    source: 'fusionmicrofinance',
    link: 'https://fusionfin.com/careers/',
    scrapedAt: FIXED_SCRAPED_AT,
  })
  assert.equal(jobs[7].title, 'QA Engineer/Sr. QA Engineer')
  assert.equal(jobs[7].department, 'Automation Testing')
  assert.equal(jobs[7].location, 'Gurgaon/Gurugram, Haryana, India')
  assert.equal(jobs[7].city, 'Gurgaon/Gurugram')
  assert.equal(jobs[7].state, 'Haryana')
  assert.equal(jobs[7].source, 'fusionmicrofinance')
  assert.equal(jobs[7].publicExperienceChecked, true)
  assert.equal(
    jobs[7].link,
    'https://fusionfin.com/featuredjobs/qa-engineer-sr-qa-engineer/#apply',
  )
  assert.equal(jobs[7].scrapedAt, FIXED_SCRAPED_AT)
})

test('Fusion Microfinance fails closed when the verified homepage, careers surface, or detail page contract drifts', async () => {
  const fusionMicrofinance = await loadFusionMicrofinanceModule()

  await assert.rejects(
    fusionMicrofinance.createFusionMicrofinanceScraper().run({
      fetchText: async (url) => {
        if (url === fusionMicrofinance.HOMEPAGE_URL) {
          return '<html><body><h1>Placeholder</h1></body></html>'
        }

        throw new Error(`Unexpected Fusion Microfinance URL: ${url}`)
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    fusionMicrofinance.createFusionMicrofinanceScraper().run({
      fetchText: async (url) => {
        if (url === fusionMicrofinance.HOMEPAGE_URL) return homepageHtml
        if (url === fusionMicrofinance.CAREERS_URL) {
          return careersHtml.replace('MSME - Executive Operations', 'MSME - Collections Lead')
        }

        throw new Error(`Unexpected Fusion Microfinance URL: ${url}`)
      },
    }),
    /careers surface/i,
  )

  await assert.rejects(
    fusionMicrofinance.createFusionMicrofinanceScraper().run({
      fetchText: async (url) => {
        if (url === fusionMicrofinance.HOMEPAGE_URL) return homepageHtml
        if (url === fusionMicrofinance.CAREERS_URL) return careersHtml
        if (url === 'https://fusionfin.com/featuredjobs/qa-engineer-sr-qa-engineer/') {
          return '<html><body><h1>QA Engineer/Sr. QA Engineer</h1></body></html>'
        }

        throw new Error(`Unexpected Fusion Microfinance URL: ${url}`)
      },
    }),
    /detail page/i,
  )
})
