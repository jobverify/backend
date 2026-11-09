import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Rinex Education</title>
  </head>
  <body>
    <div id="root"></div>
    <a href="https://wa.me/+917892745201?text=Hello">WhatsApp</a>
    <script src="/static/js/main.01193449.js"></script>
  </body>
</html>
`

const bundleText = `
  const roles = JSON.parse('[{"id":1,"role":"ROLE 1","jobTitle":"Inside sales Strategist","jobLocation":"Bengaluru \\xb7 Mangaluru","immediateChip":"../public/images/immediate_chip.svg"},{"id":2,"role":"ROLE 2","jobTitle":"Talent Acquisition","jobLocation":"Bengaluru \\xb7 Mangaluru","immediateChip":"../public/images/immediate_chip.svg"}]');
  const footer = "Rinex Technologies Private Limited help@rinex.ai /job/:jobrole";
`

const jsOnlyDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Rinex Education</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/rinextechnologies/script.js')
  } catch {
    assert.fail('Expected Rinex Technologies scraper module at ../../scraper/rinextechnologies/script.js')
  }
}

test('Rinex Technologies extracts role listings from the verified main bundle', async () => {
  const rinex = await loadModule()
  const roles = rinex.extractBundleRoles(bundleText)

  assert.deepEqual(roles, [
    {
      title: 'Inside sales Strategist',
      locationText: 'Bengaluru / Mangaluru',
      jobId: 'inside-sales-strategist',
      requisitionId: 'inside-sales-strategist',
      sourceUrl: 'https://rinex.ai/job/Inside%20sales%20Strategist',
    },
    {
      title: 'Talent Acquisition',
      locationText: 'Bengaluru / Mangaluru',
      jobId: 'talent-acquisition',
      requisitionId: 'talent-acquisition',
      sourceUrl: 'https://rinex.ai/job/Talent%20Acquisition',
    },
  ])
})

test('Rinex Technologies falls back to bundle listing data when detail routes are JavaScript-only shells', async () => {
  const rinex = await loadModule()
  const bundleUrl = 'https://rinex.ai/static/js/main.01193449.js'

  const jobs = await rinex.createRinexTechnologiesScraper().run({
    now: () => '2026-08-08T20:00:00.000Z',
    fetchText: async (url) => {
      if (url === rinex.HOMEPAGE_URL) return homepageHtml
      if (url === bundleUrl) return bundleText
      if (
        url === 'https://rinex.ai/job/Inside%20sales%20Strategist'
        || url === 'https://rinex.ai/job/Talent%20Acquisition'
      ) {
        return jsOnlyDetailHtml
      }
      throw new Error(`Unexpected Rinex URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Inside sales Strategist',
    company: 'Rinex Technologies',
    department: null,
    location: 'Bengaluru / Mangaluru, Karnataka, India',
    city: null,
    state: 'Karnataka',
    country: 'India',
    jobId: 'inside-sales-strategist',
    requisitionId: 'inside-sales-strategist',
    sourceUrl: 'https://rinex.ai/job/Inside%20sales%20Strategist',
    applyUrl: 'https://rinex.ai/job/Inside%20sales%20Strategist',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Apply via the Rinex Technologies job page.',
    remoteStatus: 'On-site',
    source: 'rinextechnologies',
    link: 'https://rinex.ai/job/Inside%20sales%20Strategist',
    companyCareerPage: 'https://rinex.ai/career',
    companyDomain: 'rinex.ai',
    atsPlatform: 'official-company-careers',
    scrapedAt: '2026-08-08T20:00:00.000Z',
  })
})
