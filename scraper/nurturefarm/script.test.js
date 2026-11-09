import assert from 'node:assert/strict'
import test from 'node:test'

const loadNurtureFarmModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const JOIN_US_HTML = `
  <html>
    <head><title>nurture.farm - Join Us</title></head>
    <body>
      <h1>This is a rare opportunity to be part of something that is truly transformational and impactful for the world</h1>
      <p>Joining us means joining a mission to drive the change.</p>
      <a href="https://nurture.skillate.com/">View Opportunities</a>
    </body>
  </html>
`

const CAREERS_HTML = `
  <html>
    <head><title>Job openings at Nurture.Farm</title></head>
    <body>
      <main>
        <h1>Job openings at Nurture.Farm</h1>
        <p>6 Open Jobs</p>
        <div>Department</div>
        <div>All Departments Engineering Product Management Retail</div>
        <div>Location</div>
        <div>All Locations Bangalore</div>
        <div>ROLE</div>
        <div>LOCATION</div>
        <div>DEPARTMENT</div>
        <article>
          <h2>Zonal Commercial Lead</h2>
          <div>Bangalore</div>
          <div>Retail</div>
          <a href="/jobs/zonal-commercial-lead">View Job</a>
        </article>
        <article>
          <h2>Data Analyst</h2>
          <div>Bangalore</div>
          <div>Retail</div>
          <a href="/jobs/data-analyst">View Job</a>
        </article>
        <article>
          <h2>Product Manager</h2>
          <div>Bangalore</div>
          <div>Product Management</div>
          <a href="/jobs/product-manager">View Job</a>
        </article>
        <article>
          <h2>Senior Product Manager</h2>
          <div>Bangalore</div>
          <div>Product Management</div>
          <a href="/jobs/senior-product-manager">View Job</a>
        </article>
        <article>
          <h2>Category Manager</h2>
          <div>Bangalore</div>
          <div>Retail</div>
          <a href="/jobs/category-manager">View Job</a>
        </article>
        <article>
          <h2>Technical lead-Backend Engineer</h2>
          <div>Bangalore</div>
          <div>Engineering</div>
          <a href="/jobs/technical-lead-backend-engineer">View Job</a>
        </article>
        <section>
          <h2>Join Talent Pool</h2>
          <p>Submit Resume</p>
        </section>
        <footer>powered-by-skillate</footer>
      </main>
    </body>
  </html>
`

test('extractJobListings reads the verified Skillate listing sequence for Nurture.Farm', async () => {
  const nurturefarm = await loadNurtureFarmModule()
  assert.ok(nurturefarm, 'Expected nurturefarm/script.js to exist')

  assert.equal(nurturefarm.hasOfficialJoinUsSignal(JOIN_US_HTML), true)
  assert.equal(nurturefarm.hasOfficialCareersSignal(CAREERS_HTML), true)

  const jobs = nurturefarm.extractJobListings(CAREERS_HTML)

  assert.equal(jobs.length, 6)
  assert.deepEqual(jobs[0], {
    title: 'Zonal Commercial Lead',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'zonal-commercial-lead',
    requisitionId: 'zonal-commercial-lead',
    sourceUrl: 'https://nurture.skillate.com/',
    applyUrl: 'https://nurture.skillate.com/jobs/zonal-commercial-lead',
    department: 'Retail',
    employmentType: null,
    experienceRequired: null,
    postingDate: null,
    closingDate: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    jobDescription: null,
    remoteStatus: 'On-site',
  })

  assert.deepEqual(jobs[1], {
    title: 'Data Analyst',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'data-analyst',
    requisitionId: 'data-analyst',
    sourceUrl: 'https://nurture.skillate.com/',
    applyUrl: 'https://nurture.skillate.com/jobs/data-analyst',
    department: 'Retail',
    employmentType: null,
    experienceRequired: null,
    postingDate: null,
    closingDate: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    jobDescription: null,
    remoteStatus: 'On-site',
  })

  assert.deepEqual(jobs[5], {
    title: 'Technical lead-Backend Engineer',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'technical-lead-backend-engineer',
    requisitionId: 'technical-lead-backend-engineer',
    sourceUrl: 'https://nurture.skillate.com/',
    applyUrl: 'https://nurture.skillate.com/jobs/technical-lead-backend-engineer',
    department: 'Engineering',
    employmentType: null,
    experienceRequired: null,
    postingDate: null,
    closingDate: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    jobDescription: null,
    remoteStatus: 'On-site',
  })
})

test('run fetches the Skillate jobs page and decorates the shared runner fields for Nurture.Farm', async () => {
  const nurturefarm = await loadNurtureFarmModule()
  assert.ok(nurturefarm, 'Expected nurturefarm/script.js to exist')

  const requested = []
  const jobs = await nurturefarm.createNurtureFarmScraper().run({
    fetchText: async (url, options) => {
      requested.push({ url, options })
      if (url === nurturefarm.CAREERS_URL) return JOIN_US_HTML
      return CAREERS_HTML
    },
  })

  assert.deepEqual(requested, [
    { url: 'https://nurture.farm/join-us-2/', options: undefined },
    { url: 'https://nurture.skillate.com/', options: { attempts: 1 } },
  ])
  assert.equal(jobs.length, 6)
  assert.equal(jobs[0].company, 'Nurture.Farm')
  assert.equal(jobs[0].source, 'nurturefarm')
  assert.equal(jobs[0].link, 'https://nurture.skillate.com/jobs/zonal-commercial-lead')
  assert.equal(jobs[0].companyCareerPage, 'https://nurture.farm/join-us-2/')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
  assert.equal(jobs[0].verificationDate, '2026-08-04')
})

test('a live board timeout reports unknown coverage instead of replaying historical jobs', async () => {
  const nurturefarm = await loadNurtureFarmModule()
  assert.ok(nurturefarm, 'Expected nurturefarm/script.js to exist')

  const requested = []
  const timeoutError = new TypeError('fetch failed')
  timeoutError.cause = {
    code: 'UND_ERR_CONNECT_TIMEOUT',
    message: 'Connect Timeout Error (attempted address: nurture.skillate.com:443, timeout: 10000ms)',
  }

  await assert.rejects(nurturefarm.createNurtureFarmScraper().run({
    fetchText: async (url, options) => {
      requested.push({ url, options })
      if (url === nurturefarm.CAREERS_URL) return JOIN_US_HTML
      throw timeoutError
    },
  }), error => {
    assert.equal(error.cause, timeoutError)
    assert.equal(error.softFailure, true)
    assert.equal(error.failureKind, 'network_or_timeout')
    assert.equal(error.sourceListingComplete, false)
    assert.equal(error.lifecycleCleanupAllowed, false)
    assert.equal(error.inventoryEvidence.status, 'coverage-gap')
    assert.equal(error.inventoryEvidence.reportedTotal, null)
    assert.equal(error.inventoryEvidence.indiaFacetCount, null)
    return true
  })

  assert.deepEqual(requested, [
    { url: 'https://nurture.farm/join-us-2/', options: undefined },
    { url: 'https://nurture.skillate.com/', options: { attempts: 1 } },
  ])
})

test('cancellation after a native response cannot return historical or newly scraped jobs', async () => {
  const nurturefarm = await loadNurtureFarmModule()
  const controller = new AbortController()
  const reason = new Error('source cancelled')
  await assert.rejects(nurturefarm.run({ signal: controller.signal, fetchText: async url => {
    if (url === nurturefarm.CAREERS_URL) return JOIN_US_HTML
    controller.abort(reason)
    return CAREERS_HTML
  } }), error => error === reason)
})
