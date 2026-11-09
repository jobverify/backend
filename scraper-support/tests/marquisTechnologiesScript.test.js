import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Leader in Software Testing on different Platforms</h1>
      <p>Telecom Testing</p>
      <p>Mobile-Device Testing</p>
      <p>GCF Certification</p>
      <a href="https://www.marquistech.com/job-openings/">job-openings</a>
    </main>
  </body>
</html>
`

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Jobs</h1>
      <a href="https://www.marquistech.com/apply-for-job/">Apply for Job</a>
      <a href="https://www.marquistech.com/openings/device-test-engineer-marquistech-noida/">Device Test Engineer</a>
      <a href="https://www.marquistech.com/openings/telecommunication-engineer-portugal-lisbon/">Telecommunication Engineer</a>
    </main>
  </body>
</html>
`

const INDIA_OPENING_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Device Test Engineer - Marquistech - Noida - Welcome to Marquistech</title>
  </head>
  <body>
    <main>
      <p>Job Category: Engineering</p>
      <p>Job Sub Category: Telecommunications</p>
      <p>Job Type: Full Time</p>
      <p>Job Location: Noida(IND)</p>
      <p>Designation: Device Protocol Testing</p>
      <p>Experience: 0-1 Year</p>
      <p>Education: Bachelors or Master’s in Engineering</p>
      <p>Job Overview: Testing on Pre-Launched Mobiles</p>
      <p>Contact Email: hr@marquistech.com</p>
      <p>Job Overview: We are hiring a skilled Device Test Engineer.</p>
    </main>
  </body>
</html>
`

const FOREIGN_OPENING_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Telecommunication Engineer- Portugal (Lisbon) - Welcome to Marquistech</title>
  </head>
  <body>
    <main>
      <p>Job Category: Engineering</p>
      <p>Job Type: Full Time</p>
      <p>Job Location: Portugal (Lisbon)</p>
      <p>Designation: Test Engineer</p>
      <p>Experience: 3-8 Years</p>
      <p>Education: B.E/B.Tech</p>
      <p>Contact Email: hr@marquistech.com</p>
      <p>Company Description: International opening.</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/marquistechnologies/script.js')
  } catch {
    assert.fail('Expected Marquis Technologies scraper module at ../../scraper/marquistechnologies/script.js')
  }
}

test('Marquis Technologies recognizes the restored official openings surface and extracts opening urls', async () => {
  const marquis = await loadModule()

  assert.equal(marquis.SOURCE, 'marquistechnologies')
  assert.equal(marquis.COMPANY, 'Marquis Technologies')
  assert.equal(marquis.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(marquis.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.deepEqual(marquis.extractOpeningUrls(CAREERS_HTML), [
    'https://www.marquistech.com/openings/device-test-engineer-marquistech-noida/',
    'https://www.marquistech.com/openings/telecommunication-engineer-portugal-lisbon/',
  ])
})

test('Marquis Technologies returns only India openings from the restored careers route', async () => {
  const marquis = await loadModule()
  const requestedUrls = []

  const jobs = await marquis.createMarquisTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === marquis.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === marquis.CAREERS_URL) return CAREERS_HTML
      if (url === 'https://www.marquistech.com/openings/device-test-engineer-marquistech-noida/') {
        return INDIA_OPENING_HTML
      }
      if (url === 'https://www.marquistech.com/openings/telecommunication-engineer-portugal-lisbon/') {
        return FOREIGN_OPENING_HTML
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    marquis.HOMEPAGE_URL,
    marquis.CAREERS_URL,
    'https://www.marquistech.com/openings/device-test-engineer-marquistech-noida/',
    'https://www.marquistech.com/openings/telecommunication-engineer-portugal-lisbon/',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Device Test Engineer - Marquistech - Noida',
      company: 'Marquis Technologies',
      department: 'Engineering / Telecommunications',
      location: 'Noida, India',
      city: 'Noida',
      country: 'India',
      jobId: 'device-test-engineer-marquistech-noida',
      requisitionId: 'device-test-engineer-marquistech-noida',
      sourceUrl: 'https://www.marquistech.com/openings/device-test-engineer-marquistech-noida/',
      applyUrl: 'https://www.marquistech.com/apply-for-job/',
      employmentType: 'Full Time',
      experienceRequired: '0-1 Year',
      minimumQualification: 'Bachelors or Master’s in Engineering',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'We are hiring a skilled Device Test Engineer.',
    },
  ])
})

test('Marquis Technologies reports a typed blocked failure for the current HTTP 307 homepage challenge', async () => {
  const marquis = await loadModule()
  const redirectChallenge = Object.assign(
    new Error(`HTTP 307 for ${marquis.HOMEPAGE_URL}`),
    { status: 307 },
  )
  const requestedUrls = []

  await assert.rejects(
    marquis.createMarquisTechnologiesScraper().run({
      fetchText: async (url) => {
        requestedUrls.push(url)
        throw redirectChallenge
      },
      fetchBrowserText: async () => {
        assert.fail('Marquis should not treat the verified 307 challenge as browser-recoverable')
      },
    }),
    (error) => {
      assert.match(error.message, /Marquis Technologies homepage is currently blocked/i)
      assert.equal(error.cause, redirectChallenge)
      assert.equal(error.failureKind, 'blocked_or_access_denied')
      assert.equal(error.softFailure, true)
      assert.equal(error.upstreamOutage, true)
      assert.equal(error.abortRetries, true)
      return true
    },
  )

  assert.deepEqual(requestedUrls, [marquis.HOMEPAGE_URL])
})
