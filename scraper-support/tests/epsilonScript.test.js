import assert from 'node:assert/strict'
import test from 'node:test'

const loadEpsilonModule = async () => {
  try {
    return await import('../../scraper/epsilon/script.js')
  } catch {
    assert.fail('Expected Epsilon scraper module at ../../scraper/epsilon/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Epsilon | Grow With a Global Team</title>
  </head>
  <body>
    <main>
      <h1>JOIN THE TEAM</h1>
      <a href="https://careers.publicisgroupe.com/epsilon/jobs">Explore all jobs</a>
      <a href="https://careers.publicisgroupe.com/epsilon/jobs">Open positions</a>
    </main>
  </body>
</html>
`

const officialBoardErrorHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Epsilon</title>
  </head>
  <body>
    <main>
      <p>Oops</p>
      <p>An error occurred.</p>
      <p>General Error</p>
      <p>Connect with us</p>
    </main>
  </body>
</html>
`

const payload = {
  jobs: [
    {
      slug: '163554',
      req_id: '163554',
      title: 'Senior Software Engineer',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      apply_url: 'https://epsilon-publicisgroupe.icims.com/jobs/163554/login',
      description: '<p>Build data-driven platform services for Epsilon.</p>',
      qualifications: '<p>Bachelor of Engineering or equivalent experience.</p>',
      employment_type: 'FULL_TIME',
      tags1: ['Engineering'],
      tags2: ['Epsilon'],
      tags3: ['Regular'],
      tags5: ['Intermediate'],
      posted_date: '2026-07-10T08:51:00+0000',
    },
    {
      slug: '999999',
      req_id: '999999',
      title: 'Ignore US Role',
      city: 'Chicago',
      state: 'Illinois',
      country: 'United States',
      apply_url: 'https://epsilon-publicisgroupe.icims.com/jobs/999999/login',
      description: '<p>Ignore this role.</p>',
      employment_type: 'FULL_TIME',
      tags1: ['Engineering'],
      tags2: ['Epsilon'],
      tags3: ['Regular'],
      posted_date: '2026-07-10T08:51:00+0000',
    },
  ],
  totalCount: 2,
}

test('extractSearchResults keeps only India listings from the official Epsilon Jibe API', async () => {
  const epsilon = await loadEpsilonModule()
  const jobs = epsilon.extractSearchResults(payload)

  assert.equal(epsilon.COMPANY, 'Epsilon')
  assert.equal(epsilon.CAREERS_URL, 'https://www.epsilon.com/apac/careers-at-epsilon')
  assert.equal(epsilon.PUBLIC_JOBS_BOARD_URL, 'https://careers.publicisgroupe.com/epsilon/jobs')
  assert.equal(epsilon.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    epsilon.buildJobsApiUrl(1),
    'https://careers.publicisgroupe.com/api/jobs?page=1&country=India&tags2=Epsilon&internal=false&separator=%7C&facetField=country%7Cstate%7Ccity%7Clocation_type',
  )
  assert.equal(epsilon.hasOfficialPublicBoardErrorSignal(officialBoardErrorHtml), true)
  assert.equal(epsilon.hasVisiblePublicJobLink(officialBoardErrorHtml), false)
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Software Engineer',
    company: 'Epsilon',
    department: 'Engineering',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '163554',
    requisitionId: '163554',
    sourceUrl: 'https://careers.publicisgroupe.com/jobs/163554?lang=en-us',
    applyUrl: 'https://epsilon-publicisgroupe.icims.com/jobs/163554/login',
    employmentType: 'FULL_TIME',
    experienceRequired: 'Intermediate',
    minimumQualification: 'Bachelor of Engineering or equivalent experience.',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-10T08:51:00+0000',
    closingDate: null,
    jobDescription: 'Build data-driven platform services for Epsilon.',
    jobType: 'Regular',
    additionalLocations: null,
  })
})

test('run verifies the official Epsilon careers handoff before reading the public Jibe API', async () => {
  const epsilon = await loadEpsilonModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await epsilon.createEpsilonScraper({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      return officialCareersHtml
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      return {
        jobs: [payload.jobs[0]],
        totalCount: 1,
      }
    },
  }).run()

  assert.deepEqual(requestedTextUrls, [
    epsilon.CAREERS_URL,
  ])
  assert.deepEqual(requestedJsonUrls, [
    epsilon.buildJobsApiUrl(1),
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'epsilon')
  assert.equal(
    jobs[0].link,
    'https://epsilon-publicisgroupe.icims.com/jobs/163554/login',
  )
})

test('run returns an empty set when the official Publicis board is serving a verified first-party error state', async () => {
  const epsilon = await loadEpsilonModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await epsilon.createEpsilonScraper({
    fetchText: async (url) => {
      requestedTextUrls.push(url)

      if (url === epsilon.CAREERS_URL) return officialCareersHtml
      if (url === epsilon.PUBLIC_JOBS_BOARD_URL) return officialBoardErrorHtml
      if (url === epsilon.INDIA_LOCATION_URL) return officialBoardErrorHtml

      throw new Error(`Unexpected Epsilon HTML URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      throw new Error('HTTP 503')
    },
  }).run()

  assert.deepEqual(jobs, [])
  assert.deepEqual(requestedJsonUrls, [
    epsilon.buildJobsApiUrl(1),
  ])
  assert.deepEqual(requestedTextUrls, [
    epsilon.CAREERS_URL,
    epsilon.PUBLIC_JOBS_BOARD_URL,
    epsilon.INDIA_LOCATION_URL,
  ])
})

test('run fails closed when the official Epsilon careers handoff changes', async () => {
  const epsilon = await loadEpsilonModule()
  let apiCalled = false

  await assert.rejects(
    epsilon.createEpsilonScraper({
      fetchText: async () => '<html><body><a href="https://careers.publicisgroupe.com/publiciscareers/jobs">Jobs</a></body></html>',
      fetchJson: async () => {
        apiCalled = true
        return payload
      },
    }).run(),
    /official epsilon careers handoff changed/i,
  )

  assert.equal(apiCalled, false)
})
