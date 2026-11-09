import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Way Dot Com India scraper module at ./script.js')
  }
}

const careersShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Way | Find &amp; Reserve Parking, Car Wash, Roadside Assistance &amp; More</title>
  </head>
  <body>
    <main>
      <h2>Join our Team of Innovators and Creators</h2>
      <p>Filter by department</p>
      <p>Filter by location</p>
      <div class="card">
        <div class="card-maintxt"><p>Marketing</p></div>
        <button class="view-jobs-btn">View Jobs</button>
      </div>
    </main>
  </body>
</html>
`

const expandedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Way | Find &amp; Reserve Parking, Car Wash, Roadside Assistance &amp; More</title>
  </head>
  <body>
    <main>
      <h2>Join our Team of Innovators and Creators</h2>
      <p>Filter by department</p>
      <p>Filter by location</p>
      <button class="view-jobs-btn">View Jobs</button>
      <div class="job-card">
        <div class="fcard-title d-flex align-items-center">App Store Acquisition Specialist</div>
        <div class="d-flex align-items-center mt-8">Full Time</div>
        <div class="d-flex align-items-center mt-8">Fremont, California</div>
        <button class="outline-btn-grn">Apply Now</button>
      </div>
      <div class="job-card">
        <div class="fcard-title d-flex align-items-center">App Store Acquisition Specialist</div>
        <div class="d-flex align-items-center mt-8">Full Time</div>
        <div class="d-flex align-items-center mt-8">Trivandrum, Kerala</div>
        <button class="outline-btn-grn">Apply Now</button>
      </div>
      <div class="job-card">
        <div class="fcard-title d-flex align-items-center">SEO Team Lead</div>
        <div class="d-flex align-items-center mt-8">Full Time</div>
        <div class="d-flex align-items-center mt-8">Trivandrum, Kerala</div>
        <button class="outline-btn-grn">Apply Now</button>
      </div>
    </main>
  </body>
</html>
`

const indiaDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>App Store Acquisition Specialist - Way.com</title>
  </head>
  <body>
    <main>
      <a href="/careers">&lt; Back</a>
      <p>Careers | App Store Acquisition Specialist</p>
      <h1>App Store Acquisition Specialist</h1>
      <div>Full Time</div>
      <div>Trivandrum, Kerala</div>
      <div>Posted on 11-April-2025</div>
      <h2>Job Summary</h2>
      <p>Way.com is looking for an experienced and innovative App Store Acquisition Specialist to join our growing team.</p>
      <p>This role focuses on driving app installations and optimizing keyword bidding campaigns in the Apple App Store and Google Play Store.</p>
      <h2>Key Responsibilities</h2>
      <p>Plan, execute, and optimize campaigns.</p>
      <p>Send your CV/Resume to hrus@way.com to apply for this post</p>
      <button class="outline-btn-grn">Apply Now</button>
    </main>
  </body>
</html>
`

const usDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>App Store Acquisition Specialist - Way.com</title>
  </head>
  <body>
    <main>
      <h1>App Store Acquisition Specialist</h1>
      <div>Full Time</div>
      <div>Fremont, California</div>
      <div>Posted on 11-April-2025</div>
      <h2>Job Summary</h2>
      <p>US-only job.</p>
      <p>Send your CV/Resume to hrus@way.com to apply for this post</p>
      <button class="outline-btn-grn">Apply Now</button>
    </main>
  </body>
</html>
`

const cloudflareChallengeHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Just a moment...</title>
  </head>
  <body>
    <div>Cloudflare</div>
    <div>Please enable cookies.</div>
    <script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script>
  </body>
</html>
`

test('Way.com scraper verifies the official careers shell and extracts visible public job cards', async () => {
  const way = await loadModule()

  assert.equal(way.SOURCE, 'waydotcomindia')
  assert.equal(way.COMPANY, 'Way Dot Com India Private Limited')
  assert.equal(way.CAREERS_URL, 'https://www.way.com/careers')
  assert.equal(way.hasOfficialCareersSignal(careersShellHtml), true)
  assert.equal(way.hasOfficialCareersSignal('<main><h1>Careers</h1></main>'), false)

  assert.deepEqual(way.extractJobCards(expandedCareersHtml), [
    {
      title: 'App Store Acquisition Specialist',
      department: null,
      employmentType: 'Full Time',
      location: 'Fremont, California',
    },
    {
      title: 'App Store Acquisition Specialist',
      department: null,
      employmentType: 'Full Time',
      location: 'Trivandrum, Kerala',
    },
    {
      title: 'SEO Team Lead',
      department: null,
      employmentType: 'Full Time',
      location: 'Trivandrum, Kerala',
    },
  ])
})

test('Way.com scraper normalizes a first-party India detail route and preserves the official email apply instruction', async () => {
  const way = await loadModule()

  const job = way.extractJobDetail(indiaDetailHtml, {
    title: 'App Store Acquisition Specialist',
    employmentType: 'Full Time',
    location: 'Trivandrum, Kerala',
    sourceUrl: 'https://www.way.com/careers/12/app-store-acquisition-specialist?from=profile',
  })

  assert.deepEqual(job, {
    title: 'App Store Acquisition Specialist',
    company: 'Way Dot Com India Private Limited',
    department: null,
    location: 'Trivandrum, Kerala, India',
    city: 'Trivandrum',
    country: 'India',
    jobId: '12',
    requisitionId: '12',
    sourceUrl: 'https://www.way.com/careers/12/app-store-acquisition-specialist?from=profile',
    applyUrl: 'mailto:hrus@way.com',
    employmentType: 'Full Time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '11-April-2025',
    closingDate: null,
    jobDescription: 'Way.com is looking for an experienced and innovative App Store Acquisition Specialist to join our growing team. This role focuses on driving app installations and optimizing keyword bidding campaigns in the Apple App Store and Google Play Store. Key Responsibilities Plan, execute, and optimize campaigns.',
  })
})

test('Way.com scraper run keeps only India jobs and adds scraper metadata', async () => {
  const way = await loadModule()

  const jobs = await way.createWayDotComIndiaScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      assert.equal(url, way.CAREERS_URL)
      return careersShellHtml
    },
    fetchJson: async (url) => {
      assert.equal(url, way.JOBS_JSON_URL)
      return [
        {
          id: 11,
          title: 'App Store Acquisition Specialist',
          department: null,
          jobType: 'Full Time',
          location: 'Fremont, California',
          countryCode: 'US',
          description: '<p>US-only job.</p>',
          skills: [],
          date: '11-April-2025',
        },
        {
          id: 12,
          title: 'App Store Acquisition Specialist',
          department: null,
          jobType: 'Full Time',
          location: 'Trivandrum, Kerala',
          countryCode: 'IN',
          description: '<p>Way.com is looking for an experienced and innovative App Store Acquisition Specialist to join our growing team.</p>',
          skills: [],
          date: '11-April-2025',
        },
      ]
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'waydotcomindia')
  assert.equal(jobs[0].sourceUrl, 'https://www.way.com/careers/12/app-store-acquisition-specialist?from=profile')
  assert.equal(jobs[0].applyUrl, 'mailto:careers@way.com')
  assert.equal(jobs[0].link, 'https://www.way.com/careers/12/app-store-acquisition-specialist?from=profile')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('Way.com page-settle wait supports Puppeteer versions without waitForTimeout', async () => {
  const way = await loadModule()
  const calls = []

  await way.waitForPageSettle({
    waitForTimeout: async (timeoutMs) => {
      calls.push(timeoutMs)
    },
  }, 7)

  assert.deepEqual(calls, [7])

  const startedAt = Date.now()
  await way.waitForPageSettle({}, 1)
  assert.equal(Date.now() >= startedAt, true)
})

test('Way.com scraper returns a verified zero-job result when both public careers surfaces are Cloudflare challenged', async () => {
  const way = await loadModule()

  const jobs = await way.createWayDotComIndiaScraper().run({
    fetchText: async () => cloudflareChallengeHtml,
    fetchJson: async () => cloudflareChallengeHtml,
  })

  assert.deepEqual(jobs, [])
})

test('Way.com scraper fails closed when the official surface or detail route changes', async () => {
  const way = await loadModule()

  await assert.rejects(
    way.createWayDotComIndiaScraper().run({
      fetchText: async () => '<main><h1>Careers</h1></main>',
      fetchJson: async () => [],
    }),
    /official careers surface/i,
  )

  assert.throws(
    () => way.extractJobDetail(
      indiaDetailHtml.replace('Send your CV/Resume to hrus@way.com to apply for this post', 'Apply with your profile'),
      {
        title: 'App Store Acquisition Specialist',
        employmentType: 'Full Time',
        location: 'Trivandrum, Kerala',
        sourceUrl: 'https://www.way.com/careers/12/app-store-acquisition-specialist?from=profile',
      },
    ),
    /verified public job detail surface/i,
  )
})
