import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-20T16:20:00.000Z'

const careersHtml = `
<!doctype html>
<html>
  <head>
    <title>Way | Find &amp; Reserve Parking, Car Wash, Roadside Assistance &amp; More</title>
  </head>
  <body>
    <h1>Join our Team of Innovators and Creators</h1>
    <label>Filter by department</label>
    <label>Filter by location</label>
    <button class="view-jobs-btn">View Jobs</button>
  </body>
</html>
`

const jobsJson = [
  {
    id: 3,
    title: 'Senior Android Developer',
    department: 'Engineering',
    jobType: 'Full Time',
    location: 'Fremont, California',
    countryCode: 'us',
    date: '11-April-2025',
    skills: ['Kotlin'],
    description: '<p>Build Android apps.</p>',
  },
  {
    id: 4,
    title: 'Senior Android Developer',
    department: 'Engineering',
    jobType: 'Full Time',
    location: 'Trivandrum, Kerala',
    countryCode: 'in',
    date: '11-April-2025',
    skills: ['Kotlin', 'Jetpack Compose'],
    description: '<p><strong>Role Overview</strong></p><p>Build Android apps for Way.com.</p>',
  },
]

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

const loadModule = async () => {
  try {
    return await import('../../scraper/waydotcomindia/script.js')
  } catch {
    assert.fail('Expected Way Dot Com India scraper module at ../../scraper/waydotcomindia/script.js')
  }
}

test('Way.com extracts India jobs from the current careers JSON payload', async () => {
  const way = await loadModule()

  assert.equal(way.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(way.extractJobsFromJson(jobsJson, { scrapedAt: FIXED_SCRAPED_AT }), [
    {
      title: 'Senior Android Developer',
      company: 'Way Dot Com India Private Limited',
      department: 'Engineering',
      location: 'Trivandrum, Kerala, India',
      city: 'Trivandrum',
      country: 'India',
      jobId: '4',
      requisitionId: '4',
      sourceUrl: 'https://www.way.com/careers/4/senior-android-developer?from=profile',
      applyUrl: 'mailto:careers@way.com',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Kotlin', 'Jetpack Compose'],
      postingDate: '11-April-2025',
      closingDate: null,
      jobDescription: 'Role Overview Build Android apps for Way.com.',
      source: 'waydotcomindia',
      companyDomain: 'way.com',
      companyCareerPage: 'https://www.way.com/careers',
      link: 'https://www.way.com/careers/4/senior-android-developer?from=profile',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Way.com run uses the official careers response plus jobs JSON payload', async () => {
  const way = await loadModule()
  const jobs = await way.createWayDotComIndiaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async () => careersHtml,
    fetchJson: async () => jobsJson,
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Senior Android Developer')
  assert.equal(jobs[0].city, 'Trivandrum')
})

test('Way.com run returns a verified zero-job result when both public surfaces are Cloudflare challenged', async () => {
  const way = await loadModule()

  const jobs = await way.createWayDotComIndiaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async () => cloudflareChallengeHtml,
    fetchJson: async () => cloudflareChallengeHtml,
  })

  assert.deepEqual(jobs, [])
})
