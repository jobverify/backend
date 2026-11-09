import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Job Openings at Harbinger Group</title>
  </head>
  <body>
    <main>
      <h1>Grow With Us</h1>
      <p>Current Openings</p>
      <a href="https://harbingergroup.darwinbox.in/ms/candidate/careers">Current Openings</a>
    </main>
  </body>
</html>
`

const darwinboxPayload = {
  job_counts: 1,
  data: [
    {
      id: 'HB-IND-001',
      title: 'Senior Software Engineer',
      department_name: 'Engineering',
      locations: 'Pune, India',
      country: 'India',
      emp_type_name: 'Full-time',
      experience: '5-8 years',
      posted_on: '2026-08-01T00:00:00Z',
      jd: '<p>Build enterprise software.</p>',
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/harbingersystems/script.js')
  } catch {
    assert.fail('Expected Harbinger Systems scraper module at ../../scraper/harbingersystems/script.js')
  }
}

test('Harbinger Systems accepts the current first-party careers title and Darwinbox handoff', async () => {
  const harbingerSystems = await loadModule()

  assert.equal(harbingerSystems.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    harbingerSystems.buildDarwinboxListingApiUrl(),
    'https://harbingergroup.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )
})

test('Harbinger Systems run validates the current careers shell before using Darwinbox listings', async () => {
  const harbingerSystems = await loadModule()
  const requested = []

  const jobs = await harbingerSystems.createHarbingerSystemsScraper({
    maxPages: 1,
    maxJobs: 1,
  }).run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === harbingerSystems.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected Harbinger Systems fixture URL: ${url}`)
    },
    fetchListingPage: async (params) => {
      requested.push({ type: 'listing', params })
      return darwinboxPayload
    },
  })

  assert.deepEqual(requested, [
    { type: 'text', url: harbingerSystems.CAREERS_URL },
    { type: 'listing', params: { page: 1, pageSize: 10, companyId: 'main', signal: undefined } },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'harbingersystems')
  assert.equal(jobs[0].company, 'Harbinger Systems')
  assert.equal(jobs[0].location, 'Pune, India')
})
