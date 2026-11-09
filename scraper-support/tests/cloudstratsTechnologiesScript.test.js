import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T12:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Employment Application</h1>
    <h2>Unlock your potential with cloudstrats</h2>
    <h2>Current Opportunities</h2>

    <article>
      <a href="https://cloudstrats.ai/job/1/">Cloud Engineer</a>
      <p>Type: Full-Time</p>
      <p>We are seeking a motivated and enthusiastic individual to join our team as a Cloud Computing Engineer.</p>
      <a href="https://cloudstrats.ai/job/1/">Browse</a>
      <a href="https://cloudstrats.ai/apply/1/">Apply</a>
    </article>

    <article>
      <a href="https://cloudstrats.ai/job/2/">Management Traniee</a>
      <p>Type: Internship</p>
      <p>As a Management Trainee, you will play a crucial role in preparing for future management positions within our organization.</p>
      <a href="https://cloudstrats.ai/job/2/">Browse</a>
      <a href="https://cloudstrats.ai/apply/2/">Apply</a>
    </article>

    <article>
      <a href="https://cloudstrats.ai/job/3/">Executive Assistant</a>
      <p>Type: Full-Time</p>
      <p>Calendar Management: Schedule and coordinate meetings, appointments, and travel arrangements for the CEO.</p>
      <a href="https://cloudstrats.ai/job/3/">Browse</a>
      <a href="https://cloudstrats.ai/apply/3/">Apply</a>
    </article>
  </body>
</html>
`

const cloudEngineerDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Employment Application</h1>
    <h2>Cloud Engineer</h2>
    <p>Type: Full-Time</p>
    <p>Posted: March 17, 2025</p>
    <h5>Job Description</h5>
    <p>We are seeking a motivated and enthusiastic individual to join our team as a Cloud Computing Engineer.</p>
    <a href="https://cloudstrats.ai/apply/1/">Apply Now</a>
  </body>
</html>
`

const managementTraineeDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Employment Application</h1>
    <h2>Management Traniee</h2>
    <p>Type: Internship</p>
    <p>Posted: March 12, 2025</p>
    <h5>Job Description</h5>
    <p>As a Management Trainee, you will play a crucial role in preparing for future management positions within our organization.</p>
    <a href="https://cloudstrats.ai/apply/2/">Apply Now</a>
  </body>
</html>
`

const executiveAssistantDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Employment Application</h1>
    <h2>Executive Assistant</h2>
    <p>Type: Full-Time</p>
    <p>Posted: March 10, 2025</p>
    <h5>Job Description</h5>
    <p>Calendar Management: Schedule and coordinate meetings, appointments, and travel arrangements for the CEO.</p>
    <a href="https://cloudstrats.ai/apply/3/">Apply Now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/cloudstratstechnologies/script.js')
  } catch {
    assert.fail('Expected Cloudstrats Technologies scraper module at ../../scraper/cloudstratstechnologies/script.js')
  }
}

test('Cloudstrats Technologies helpers stay pinned to the verified first-party careers contract', async () => {
  const cloudstrats = await loadModule()

  assert.equal(cloudstrats.SOURCE, 'cloudstratstechnologies')
  assert.equal(cloudstrats.COMPANY, 'Cloudstrats Technologies')
  assert.equal(cloudstrats.CAREERS_URL, 'https://cloudstrats.ai/careers/')
  assert.equal(cloudstrats.VERIFIED_ON, '2026-07-17')
  assert.equal(cloudstrats.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(
    cloudstrats.extractOpenRoles(careersHtml),
    [
      {
        title: 'Cloud Engineer',
        employmentType: 'Full-Time',
        summary:
          'We are seeking a motivated and enthusiastic individual to join our team as a Cloud Computing Engineer.',
        detailUrl: 'https://cloudstrats.ai/job/1/',
        applyUrl: 'https://cloudstrats.ai/apply/1/',
      },
      {
        title: 'Management Traniee',
        employmentType: 'Internship',
        summary:
          'As a Management Trainee, you will play a crucial role in preparing for future management positions within our organization.',
        detailUrl: 'https://cloudstrats.ai/job/2/',
        applyUrl: 'https://cloudstrats.ai/apply/2/',
      },
      {
        title: 'Executive Assistant',
        employmentType: 'Full-Time',
        summary:
          'Calendar Management: Schedule and coordinate meetings, appointments, and travel arrangements for the CEO.',
        detailUrl: 'https://cloudstrats.ai/job/3/',
        applyUrl: 'https://cloudstrats.ai/apply/3/',
      },
    ],
  )
})

test('Cloudstrats Technologies run validates the careers page and returns normalized jobs', async () => {
  const cloudstrats = await loadModule()
  const requestedUrls = []

  const jobs = await cloudstrats.createCloudstratsTechnologiesScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url, options) => {
      requestedUrls.push({ url, options })
      if (url === cloudstrats.CAREERS_URL) return careersHtml
      if (url === 'https://cloudstrats.ai/job/1/') return cloudEngineerDetailHtml
      if (url === 'https://cloudstrats.ai/job/2/') return managementTraineeDetailHtml
      if (url === 'https://cloudstrats.ai/job/3/') return executiveAssistantDetailHtml
      throw new Error(`Unexpected Cloudstrats URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    { url: cloudstrats.CAREERS_URL, options: { attempts: 1 } },
    { url: 'https://cloudstrats.ai/job/1/', options: undefined },
    { url: 'https://cloudstrats.ai/job/2/', options: undefined },
    { url: 'https://cloudstrats.ai/job/3/', options: undefined },
  ])
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.jobId, job.applyUrl, job.employmentType, job.companyDomain]),
    [
      [
        'Cloud Engineer',
        'India',
        'cloud-engineer',
        'https://cloudstrats.ai/apply/1/',
        'Full-Time',
        'cloudstrats.ai',
      ],
      [
        'Management Traniee',
        'India',
        'management-traniee',
        'https://cloudstrats.ai/apply/2/',
        'Internship',
        'cloudstrats.ai',
      ],
      [
        'Executive Assistant',
        'India',
        'executive-assistant',
        'https://cloudstrats.ai/apply/3/',
        'Full-Time',
        'cloudstrats.ai',
      ],
    ],
  )
  assert.equal(jobs.every((job) => job.scrapedAt === FIXED_SCRAPED_AT), true)
})

test('Cloudstrats Technologies fails closed when the verified careers page drifts', async () => {
  const cloudstrats = await loadModule()

  await assert.rejects(
    cloudstrats.createCloudstratsTechnologiesScraper().run({
      fetchText: async () => '<html><body><h2>Jobs</h2></body></html>',
    }),
    /verified Cloudstrats careers page/i,
  )
})

test('Cloudstrats Technologies aborts retries for verified careers connect timeouts', async () => {
  const cloudstrats = await loadModule()
  const requested = []
  const timeoutError = new TypeError('fetch failed')
  timeoutError.cause = {
    code: 'UND_ERR_CONNECT_TIMEOUT',
    message: 'Connect Timeout Error (attempted address: cloudstrats.ai:443, timeout: 10000ms)',
  }

  await assert.rejects(
    cloudstrats.createCloudstratsTechnologiesScraper().run({
      fetchText: async (url, options) => {
        requested.push({ url, options })
        throw timeoutError
      },
    }),
    (error) => {
      assert.match(error.message, /Cloudstrats verified careers page timed out/i)
      assert.equal(error.abortRetries, true)
      assert.equal(error.softFailure, true)
      assert.equal(error.upstreamOutage, true)
      assert.equal(error.failureKind, 'network_or_timeout')
      return true
    },
  )

  assert.deepEqual(requested, [
    { url: cloudstrats.CAREERS_URL, options: { attempts: 1 } },
  ])
})
