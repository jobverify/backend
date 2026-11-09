import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const careersHtml = `
  <main>
    <h1>Careers at Acceleration Robotics</h1>
    <p>Build the future of robotics with us.</p>
    <p>Open Roles</p>
    <article class="job-card">
      <a href="/jobs/123e4567-e89b-12d3-a456-426614174000">
        <h3>Robotics Software Engineer - Outdoor Autonomy</h3>
        <span class="category">Software</span>
        <span class="location">Pune</span>
        <span class="work-mode">Onsite</span>
        <span class="employment-type">Full Time</span>
        <span class="experience">5+ yrs</span>
        <time datetime="2026-05-25">Posted 2026-05-25</time>
      </a>
    </article>
  </main>
`

const detailHtml = `
  <main>
    <h1>Robotics Software Engineer - Outdoor Autonomy</h1>
    <div class="job-meta">
      <span>Software</span><span>Pune</span><span>Onsite</span>
      <span>Full Time</span><span>5+ years</span>
      <span>Posted 2026-05-25</span>
    </div>
    <section><h2>About the Role</h2><p>Build reliable autonomy for outdoor robots.</p></section>
    <section><h2>Requirements &amp; Qualifications</h2><ul><li>Strong robotics software experience.</li></ul></section>
    <a href="/jobs/123e4567-e89b-12d3-a456-426614174000/apply">Apply Now</a>
  </main>
`

const buildConnectTimeoutError = () => {
  const error = new TypeError('fetch failed')
  error.cause = {
    code: 'UND_ERR_CONNECT_TIMEOUT',
    message: 'Connect Timeout Error (attempted addresses: 172.67.149.242:443, 104.21.57.209:443, timeout: 10000ms)',
  }
  return error
}

const buildHttp530Error = () => new Error('HTTP 530 for https://recruit.accelerationrobotics.in/')

test('extractJobListings maps official Acceleration Robotics career cards', async () => {
  const accelerationRobotics = await loadModule()
  assert.ok(accelerationRobotics)
  const {
    CAREERS_URL,
    COMPANY,
    SOURCE,
    VERIFIED_ON,
    extractJobListings,
    hasConnectTimeoutFailure,
    hasOfficialCareersSignal,
  } = accelerationRobotics

  assert.equal(CAREERS_URL, 'https://recruit.accelerationrobotics.in/')
  assert.equal(COMPANY, 'Acceleration Robotics')
  assert.equal(SOURCE, 'accelerationrobotics')
  assert.equal(VERIFIED_ON, '2026-08-15')
  assert.equal(hasConnectTimeoutFailure(buildConnectTimeoutError()), true)
  assert.equal(hasConnectTimeoutFailure(buildHttp530Error()), true)
  assert.equal(hasOfficialCareersSignal(careersHtml), true)

  assert.deepEqual(extractJobListings(careersHtml), [{
    title: 'Robotics Software Engineer - Outdoor Autonomy',
    location: 'Pune',
    city: 'Pune',
    country: 'India',
    jobId: '123e4567-e89b-12d3-a456-426614174000',
    requisitionId: '123e4567-e89b-12d3-a456-426614174000',
    sourceUrl: 'https://recruit.accelerationrobotics.in/jobs/123e4567-e89b-12d3-a456-426614174000',
    applyUrl: null,
    department: 'Software',
    employmentType: 'Full-time',
    experienceRequired: '5+ years',
    postingDate: '2026-05-25',
  }])
})

test('run enriches official Acceleration Robotics listings from their detail pages', async () => {
  const accelerationRobotics = await loadModule()
  assert.ok(accelerationRobotics)
  const { CAREERS_URL, createAccelerationRoboticsScraper } = accelerationRobotics

  const requestedUrls = []
  const scraper = createAccelerationRoboticsScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_URL) return careersHtml
      if (url.endsWith('/123e4567-e89b-12d3-a456-426614174000')) return detailHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    CAREERS_URL,
    'https://recruit.accelerationrobotics.in/jobs/123e4567-e89b-12d3-a456-426614174000',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Acceleration Robotics')
  assert.equal(jobs[0].jobDescription, 'Build reliable autonomy for outdoor robots.')
  assert.equal(jobs[0].applyUrl, 'https://recruit.accelerationrobotics.in/jobs/123e4567-e89b-12d3-a456-426614174000/apply')
  assert.equal(jobs[0].source, 'accelerationrobotics')
})

test('run preserves the failure when an Acceleration Robotics detail page times out', async () => {
  const accelerationRobotics = await loadModule()
  assert.ok(accelerationRobotics)
  const { CAREERS_URL, createAccelerationRoboticsScraper } = accelerationRobotics

  const scraper = createAccelerationRoboticsScraper()
  const failure = buildConnectTimeoutError()
  await assert.rejects(scraper.run({
    fetchText: async (url) => {
      if (url === CAREERS_URL) return careersHtml
      throw failure
    },
  }), (error) => error === failure)
})

test('run rejects when the Acceleration Robotics careers page is unavailable', async () => {
  const accelerationRobotics = await loadModule()
  assert.ok(accelerationRobotics)
  const { CAREERS_URL, createAccelerationRoboticsScraper } = accelerationRobotics

  const requestedUrls = []
  const scraper = createAccelerationRoboticsScraper()
  const failure = buildHttp530Error()
  await assert.rejects(scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      throw failure
    },
  }), (error) => error === failure)

  assert.deepEqual(requestedUrls, [CAREERS_URL])
})
