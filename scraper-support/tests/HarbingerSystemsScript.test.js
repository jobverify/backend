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

test('Harbinger retains its historical first-party title and Darwinbox handoff helpers', async () => {
  const harbingerSystems = await loadModule()

  assert.equal(harbingerSystems.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    harbingerSystems.buildDarwinboxListingApiUrl(),
    'https://harbingergroup.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )
})

// Historical parser helpers remain below their original verification date.
// Current source-directory tests replay complete original native HTTP inputs.
test('Harbinger current acquisition requires the original native tenant and HTTP blocker receipts', async () => {
  const harbinger = await loadModule()
  await assert.rejects(harbinger.createHarbingerSystemsScraper().run({ fetchText: async () => careersHtml, fetchListingPage: async () => darwinboxPayload }), /original HTTP metadata|body-only/i)
})
