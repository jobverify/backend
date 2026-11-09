import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers</title>
  </head>
  <body>
    <main>
      <h1>We help people get jobs.</h1>
      <h2>Opportunities around the globe</h2>
      <p>Choose a location to search for open roles at Indeed.</p>
      <a href="https://in.indeed.com/careers">India</a>
    </main>
  </body>
</html>
`

const indiaJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Indeed Jobs and Careers | Indeed.com</title>
  </head>
  <body>
    <main>
      <h1>Indeed Jobs</h1>
      <h2>16 jobs at Indeed</h2>
      <ul>
        <li data-jobkey="abc123">
          <h3><a href="/viewjob?jk=abc123">Software Engineer III</a></h3>
          <div>Remote</div>
          <div>₹42,50,000 - ₹67,90,000 a year</div>
          <div>Full-time</div>
        </li>
        <li data-jobkey="def456">
          <h3><a href="/viewjob?jk=def456">Software Engineer II</a></h3>
          <div>Hyderabad, Telangana</div>
          <div>₹29,30,000 - ₹46,90,000 a year</div>
        </li>
        <li data-jobkey="ghi789">
          <h3><a href="/viewjob?jk=ghi789">National Account Manager - Staffing Agencies</a></h3>
          <div>Mumbai, Maharashtra</div>
          <div>₹15,20,000 - ₹41,00,000 a year</div>
        </li>
      </ul>
      <footer>
        <a href="/careers">Work at Indeed</a>
      </footer>
    </main>
  </body>
</html>
`

const challengeHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Security Check - Indeed.com</title>
  </head>
  <body>
    <script>window.__STATE__ = { PAGE_TYPE:"captcha" }</script>
    <h1>Additional Verification Required</h1>
  </body>
</html>
`

const justAMomentChallengeHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Just a moment...</title>
  </head>
  <body>
    <main>
      <h1>Additional Verification Required</h1>
      <p>Verification successful. Waiting for in.indeed.com to respond</p>
      <p>Cloudflare Ray ID: 1234567890abcdef</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/indeed/script.js')
  } catch {
    assert.fail('Expected Indeed scraper module at ../../scraper/indeed/script.js')
  }
}

test('Indeed helpers stay pinned to the verified careers handoff, India jobs board, and Cloudflare challenge markers', async () => {
  const indeed = await loadModule()

  assert.equal(indeed.SOURCE, 'indeed')
  assert.equal(indeed.COMPANY, 'Indeed')
  assert.equal(indeed.CAREERS_URL, 'https://www.indeed.com/careers')
  assert.equal(indeed.INDIA_CAREERS_URL, 'https://in.indeed.com/careers')
  assert.equal(indeed.INDIA_JOBS_URL, 'https://in.indeed.com/cmp/Indeed/jobs')
  assert.equal(indeed.VERIFIED_ON, '2026-08-02')
  assert.equal(indeed.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(indeed.extractIndiaCareersUrl(careersHtml), indeed.INDIA_CAREERS_URL)
  assert.equal(indeed.hasIndiaJobsSignal(indiaJobsHtml), true)
  assert.equal(indeed.pageIndicatesCloudflareChallenge(challengeHtml), true)
  assert.equal(indeed.pageIndicatesCloudflareChallenge(justAMomentChallengeHtml), true)
  assert.equal(indeed.pageIndicatesCloudflareChallenge(indiaJobsHtml), false)
})

test('Indeed extracts public India jobs from the verified first-party company jobs page', async () => {
  const indeed = await loadModule()

  const jobs = indeed.extractPublicJobsFromIndiaJobsPage(indiaJobsHtml, {
    scrapedAt: '2026-07-16T15:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'Software Engineer III',
      company: 'Indeed',
      location: 'Remote, India',
      city: null,
      country: 'India',
      jobId: 'abc123',
      requisitionId: null,
      sourceUrl: 'https://in.indeed.com/viewjob?jk=abc123',
      applyUrl: 'https://in.indeed.com/viewjob?jk=abc123',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'Remote',
      compensation: '₹42,50,000 - ₹67,90,000 a year',
      source: 'indeed',
      link: 'https://in.indeed.com/viewjob?jk=abc123',
      scrapedAt: '2026-07-16T15:00:00.000Z',
    },
    {
      title: 'Software Engineer II',
      company: 'Indeed',
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      country: 'India',
      jobId: 'def456',
      requisitionId: null,
      sourceUrl: 'https://in.indeed.com/viewjob?jk=def456',
      applyUrl: 'https://in.indeed.com/viewjob?jk=def456',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
      compensation: '₹29,30,000 - ₹46,90,000 a year',
      source: 'indeed',
      link: 'https://in.indeed.com/viewjob?jk=def456',
      scrapedAt: '2026-07-16T15:00:00.000Z',
    },
    {
      title: 'National Account Manager - Staffing Agencies',
      company: 'Indeed',
      location: 'Mumbai, Maharashtra, India',
      city: 'Mumbai',
      country: 'India',
      jobId: 'ghi789',
      requisitionId: null,
      sourceUrl: 'https://in.indeed.com/viewjob?jk=ghi789',
      applyUrl: 'https://in.indeed.com/viewjob?jk=ghi789',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
      compensation: '₹15,20,000 - ₹41,00,000 a year',
      source: 'indeed',
      link: 'https://in.indeed.com/viewjob?jk=ghi789',
      scrapedAt: '2026-07-16T15:00:00.000Z',
    },
  ])
})

test('Indeed follows the official careers handoff and returns [] when the verified jobs page is challenge-gated', async () => {
  const indeed = await loadModule()
  const requestedUrls = []

  const jobs = await indeed.createIndeedScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === indeed.CAREERS_URL) return careersHtml
      if (url === indeed.INDIA_CAREERS_URL) {
        return careersHtml.replace(/https:\/\/in\.indeed\.com\/careers/g, 'https://in.indeed.com/cmp/Indeed/jobs')
      }
      if (url === indeed.INDIA_JOBS_URL) return challengeHtml
      throw new Error(`Unexpected Indeed URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    indeed.CAREERS_URL,
    indeed.INDIA_CAREERS_URL,
    indeed.INDIA_JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Indeed returns [] when all verified first-party routes serve the current Just a moment challenge', async () => {
  const indeed = await loadModule()

  const jobs = await indeed.createIndeedScraper().run({
    fetchText: async () => justAMomentChallengeHtml,
  })

  assert.deepEqual(jobs, [])
})

test('Indeed returns [] when the live first-party routes serve the current 403 Security Check interstitial', async () => {
  const indeed = await loadModule()

  const jobs = await indeed.createIndeedScraper().run({
    fetchPage: async (url) => ({
      status: 403,
      url,
      html: challengeHtml,
    }),
  })

  assert.deepEqual(jobs, [])
})

test('Indeed fails closed when the verified careers handoff or jobs page contract drifts', async () => {
  const indeed = await loadModule()

  await assert.rejects(
    indeed.run({
      fetchText: async (url) => {
        if (url === indeed.CAREERS_URL) {
          return careersHtml.replace('https://in.indeed.com/careers', 'https://www.indeed.com/jobs')
        }
        throw new Error(`Unexpected Indeed URL: ${url}`)
      },
    }),
    /verified careers handoff/i,
  )

  await assert.rejects(
    indeed.run({
      fetchText: async (url) => {
        if (url === indeed.CAREERS_URL) return careersHtml
        if (url === indeed.INDIA_CAREERS_URL) {
          return careersHtml.replace(/https:\/\/in\.indeed\.com\/careers/g, 'https://in.indeed.com/cmp/Indeed/jobs')
        }
        if (url === indeed.INDIA_JOBS_URL) return '<html><body><h1>Unexpected jobs page</h1></body></html>'
        throw new Error(`Unexpected Indeed URL: ${url}`)
      },
    }),
    /verified india jobs page/i,
  )
})
