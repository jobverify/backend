import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-03T00:00:00.000Z'
const APPLICATION_URL = 'mailto:careers@noccarc.com?subject=Apply%20for%20Job%20at%20Noccarc'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Noccarc | MedTech Jobs in ICU Ventilators & Patient Monitors India</title>
  </head>
  <body>
    <main>
      <h1>Careers at Noccarc</h1>
      <p>Join a med-tech company building ICU ventilators, patient monitors and digital ICU platforms for Indian hospitals and beyond.</p>
      <p>Our founding team brings 12 years of critical-care engineering experience.</p>
      <a href="https://www.noccarc.com/careers">View Open Roles</a>
      <a href="${APPLICATION_URL}">Email Your CV</a>

      <section>
        <h1><span>Job&nbsp;</span><span>Openings</span></h1>

        <div class="job-card">
          <h1>Regional Sales Manager - South</h1>
          <svg></svg>
          <p>Bengaluru, Chennai, Hyderabad</p>
          <p>10&nbsp; -&nbsp; 20 years</p>
        </div>

        <div class="job-card">
          <h1>Clinical Application Specialist- South</h1>
          <svg></svg>
          <p>Bengaluru</p>
          <p>3&nbsp; -&nbsp; 8 years</p>
        </div>

        <div class="job-card">
          <h1>Senior Systems Engineer</h1>
          <svg></svg>
          <p>Pune</p>
          <p>3&nbsp; -&nbsp; 8 years</p>
        </div>

        <div class="job-card">
          <h1>Territory Sales Manager</h1>
          <svg></svg>
          <p>Ahmedabad, Mumbai, Lucknow, Chennai</p>
          <p>5&nbsp; -&nbsp; 10 years</p>
        </div>

        <div class="job-card">
          <h1>Field Service Engineer</h1>
          <svg></svg>
          <p>Bengaluru, Chandigarh</p>
          <p>3&nbsp; -&nbsp; 8 years</p>
        </div>

        <div class="job-card">
          <h1>UI/UX Designer</h1>
          <svg></svg>
          <p>Pune</p>
          <p>2&nbsp; -&nbsp; 6 years</p>
        </div>
      </section>

      <h1><span>Based on</span><span> 99 Reviews</span></h1>
    </main>
    <footer>Noccarc Robotics Pvt Ltd</footer>
  </body>
</html>
`

const DRIFTED_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Noccarc</title>
  </head>
  <body>
    <main>
      <h1>Careers at Noccarc</h1>
      <a href="https://www.noccarc.com/careers">View Open Roles</a>
      <a href="${APPLICATION_URL}">Email Your CV</a>
      <section>
        <h1><span>Job&nbsp;</span><span>Openings</span></h1>
        <p>Open positions will be updated soon.</p>
      </section>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/noccarc/script.js')
  } catch {
    assert.fail('Expected Noccarc scraper module at ../../scraper/noccarc/script.js')
  }
}

test('Noccarc helpers stay pinned to the verified Monday, August 3, 2026 first-party inline roles surface', async () => {
  const noccarc = await loadModule()

  assert.equal(noccarc.SOURCE, 'noccarc')
  assert.equal(noccarc.COMPANY, 'Noccarc')
  assert.equal(noccarc.OFFICIAL_BRAND_NAME, 'Noccarc Robotics Pvt Ltd')
  assert.equal(noccarc.VERIFIED_ON, '2026-08-03')
  assert.equal(noccarc.CAREERS_URL, 'https://www.noccarc.com/careers')
  assert.equal(noccarc.OUTBOUND_JOB_HOST, 'noccarc.com')
  assert.equal(noccarc.APPLICATION_URL, APPLICATION_URL)
  assert.equal(noccarc.hasOfficialCareersSignal(CAREERS_HTML), true)

  assert.deepEqual(noccarc.extractJobCards(CAREERS_HTML), [
    {
      title: 'Regional Sales Manager - South',
      location: 'Bengaluru, Chennai, Hyderabad',
      experienceRequired: '10 - 20 years',
    },
    {
      title: 'Clinical Application Specialist- South',
      location: 'Bengaluru',
      experienceRequired: '3 - 8 years',
    },
    {
      title: 'Senior Systems Engineer',
      location: 'Pune',
      experienceRequired: '3 - 8 years',
    },
    {
      title: 'Territory Sales Manager',
      location: 'Ahmedabad, Mumbai, Lucknow, Chennai',
      experienceRequired: '5 - 10 years',
    },
    {
      title: 'Field Service Engineer',
      location: 'Bengaluru, Chandigarh',
      experienceRequired: '3 - 8 years',
    },
    {
      title: 'UI/UX Designer',
      location: 'Pune',
      experienceRequired: '2 - 6 years',
    },
  ])
})

test('Noccarc maps inline first-party job cards into shared email-apply jobs', async () => {
  const noccarc = await loadModule()
  const requestedUrls = []

  const jobs = await noccarc.createNoccarcScraper({
    maxJobs: 3,
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === noccarc.CAREERS_URL) return CAREERS_HTML
      throw new Error(`Unexpected Noccarc fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [noccarc.CAREERS_URL])
  assert.equal(jobs.length, 3)

  assert.deepEqual(jobs[0], {
    title: 'Regional Sales Manager - South',
    company: 'Noccarc',
    location: 'Bengaluru, Chennai, Hyderabad',
    city: null,
    country: 'India',
    link: APPLICATION_URL,
    applyUrl: APPLICATION_URL,
    sourceUrl: 'https://www.noccarc.com/careers',
    source: 'noccarc',
    jobId: 'noccarc-regional-sales-manager-south-bengaluru-chennai-hyderabad',
    requisitionId: 'noccarc-regional-sales-manager-south-bengaluru-chennai-hyderabad',
    department: null,
    employmentType: null,
    experienceRequired: '10 - 20 years',
    jobDescription: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: FIXED_SCRAPED_AT,
  })

  assert.deepEqual(jobs[1], {
    title: 'Clinical Application Specialist- South',
    company: 'Noccarc',
    location: 'Bengaluru',
    city: 'Bengaluru',
    country: 'India',
    link: APPLICATION_URL,
    applyUrl: APPLICATION_URL,
    sourceUrl: 'https://www.noccarc.com/careers',
    source: 'noccarc',
    jobId: 'noccarc-clinical-application-specialist-south-bengaluru',
    requisitionId: 'noccarc-clinical-application-specialist-south-bengaluru',
    department: null,
    employmentType: null,
    experienceRequired: '3 - 8 years',
    jobDescription: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: FIXED_SCRAPED_AT,
  })

  assert.deepEqual(jobs[2], {
    title: 'Senior Systems Engineer',
    company: 'Noccarc',
    location: 'Pune',
    city: 'Pune',
    country: 'India',
    link: APPLICATION_URL,
    applyUrl: APPLICATION_URL,
    sourceUrl: 'https://www.noccarc.com/careers',
    source: 'noccarc',
    jobId: 'noccarc-senior-systems-engineer-pune',
    requisitionId: 'noccarc-senior-systems-engineer-pune',
    department: null,
    employmentType: null,
    experienceRequired: '3 - 8 years',
    jobDescription: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: FIXED_SCRAPED_AT,
  })
})

test('Noccarc fails closed when the verified careers page or job-card structure drifts', async () => {
  const noccarc = await loadModule()

  await assert.rejects(
    noccarc.createNoccarcScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /official careers page changed/i,
  )

  await assert.rejects(
    noccarc.createNoccarcScraper().run({
      fetchText: async () => DRIFTED_HTML,
    }),
    /verified first-party job-card structure/i,
  )
})
