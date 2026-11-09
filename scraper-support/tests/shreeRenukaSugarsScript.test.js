import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join The Team – Renuka Sugar</title>
  </head>
  <body>
    <main>
      <h1>Join The Team</h1>
      <h2>Come Join Shree Renuka Sugars Ltd.</h2>
      <p>Here’s a list of the current opportunities:</p>
      <div class="job-grid">
        <div>Position</div>
        <div>Department</div>
        <div>Location</div>
        <div>Experience</div>
        <div>Legal Executive</div>
        <div>Compliance</div>
        <div>Worli</div>
        <div>5.0 - 8.0 years</div>
        <button class="openOverlay" data-position="Legal Executive" data-department="Compliance" data-city="Worli">Apply</button>
        <div>Corporate Communication Head</div>
        <div>Sales &amp; Marketing</div>
        <div>Worli</div>
        <div>10.0 - 15.0 years</div>
        <button class="openOverlay" data-position="Corporate Communication Head" data-department="Sales &amp; Marketing" data-city="Worli">Apply</button>
      </div>
      <p>Additionally, you can write to us on <img src="http://renukasugars.com/wp-content/uploads/2024/11/hr.jpg" alt="hr email"></p>
      <form>
        <input type="hidden" name="jobPosition">
        <input type="hidden" name="jobDepartment">
        <input type="hidden" name="jobLocation">
      </form>
    </main>
  </body>
</html>
`

const NO_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join The Team – Renuka Sugar</title>
  </head>
  <body>
    <main>
      <h1>Join The Team</h1>
      <h2>Come Join Shree Renuka Sugars Ltd.</h2>
      <p>Here’s a list of the current opportunities:</p>
      <p>Additionally, you can write to us on <img src="http://renukasugars.com/wp-content/uploads/2024/11/hr.jpg" alt="hr email"></p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/shreerenukasugars/script.js')
  } catch {
    assert.fail('Expected Shree Renuka Sugars scraper module at ../../scraper/shreerenukasugars/script.js')
  }
}

test('Shree Renuka Sugars pins the verified first-party inline opportunities contract', async () => {
  const shreeRenukaSugars = await loadModule()

  assert.equal(shreeRenukaSugars.SOURCE, 'shreerenukasugars')
  assert.equal(shreeRenukaSugars.COMPANY, 'Shree Renuka Sugars')
  assert.equal(shreeRenukaSugars.CAREERS_URL, 'https://renukasugars.com/join-the-team/')
  assert.equal(shreeRenukaSugars.VERIFIED_ON, '2026-07-17')
  assert.equal(shreeRenukaSugars.hasVerifiedCareersPageSignal(CAREERS_HTML), true)
  assert.equal(shreeRenukaSugars.hasPublicJobSignals(CAREERS_HTML), true)
  assert.equal(shreeRenukaSugars.hasPublicJobSignals(NO_JOBS_HTML), false)

  const jobs = shreeRenukaSugars.extractInlineOpportunities(CAREERS_HTML, {
    scrapedAt: FIXED_SCRAPED_AT,
  })

  assert.deepEqual(jobs, [
    {
      title: 'Legal Executive',
      company: 'Shree Renuka Sugars',
      department: 'Compliance',
      location: 'Worli, India',
      city: 'Worli',
      state: null,
      country: 'India',
      workplaceType: null,
      jobId: 'legal-executive-worli',
      requisitionId: 'legal-executive-worli',
      sourceUrl: 'https://renukasugars.com/join-the-team/',
      applyUrl: 'https://renukasugars.com/join-the-team/',
      link: 'https://renukasugars.com/join-the-team/',
      source: 'shreerenukasugars',
      employmentType: null,
      experienceRequired: '5.0 - 8.0 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Corporate Communication Head',
      company: 'Shree Renuka Sugars',
      department: 'Sales & Marketing',
      location: 'Worli, India',
      city: 'Worli',
      state: null,
      country: 'India',
      workplaceType: null,
      jobId: 'corporate-communication-head-worli',
      requisitionId: 'corporate-communication-head-worli',
      sourceUrl: 'https://renukasugars.com/join-the-team/',
      applyUrl: 'https://renukasugars.com/join-the-team/',
      link: 'https://renukasugars.com/join-the-team/',
      source: 'shreerenukasugars',
      employmentType: null,
      experienceRequired: '10.0 - 15.0 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Shree Renuka Sugars run validates the official page and returns normalized inline jobs', async () => {
  const shreeRenukaSugars = await loadModule()
  const requestedUrls = []

  const jobs = await shreeRenukaSugars.createShreeRenukaSugarsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === shreeRenukaSugars.CAREERS_URL) return CAREERS_HTML
      throw new Error(`Unexpected Shree Renuka Sugars URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [shreeRenukaSugars.CAREERS_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'shreerenukasugars')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Shree Renuka Sugars fails closed when the verified careers surface drifts or stops exposing jobs', async () => {
  const shreeRenukaSugars = await loadModule()

  await assert.rejects(
    shreeRenukaSugars.createShreeRenukaSugarsScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified shree renuka sugars careers page/i,
  )

  await assert.rejects(
    shreeRenukaSugars.createShreeRenukaSugarsScraper().run({
      fetchText: async () => NO_JOBS_HTML,
    }),
    /public jobs surface/i,
  )
})
