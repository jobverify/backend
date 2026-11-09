import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Join Our Vibrant Team at Indi IT.</h1>
      <a href="#openroles">View Open Roles</a>
      <p>Top Opportunities Right Now.</p>
      <p>
        Job Title Experience Required Number of Vacancies Action
        Marketing Analyst Minimum 2 years of experience 2 Vacancies Apply Now
        HR Specialist Minimum 2 years of experience 3 Vacancies Apply Now
        Graphic Designer Minimum 3 years of experience 2 Vacancies Apply Now
      </p>
      <a href="mailto:hr@indiit.com">hr@indiit.com</a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/indiitsolutions/script.js')
  } catch {
    assert.fail('Expected INDI IT SOLUTIONS scraper module at ../../scraper/indiitsolutions/script.js')
  }
}

test('INDI IT SOLUTIONS extracts the live text-based opportunity cards from the verified careers page', async () => {
  const indiit = await loadModule()

  assert.equal(indiit.hasOfficialIndiItCareerSignals(careersHtml), true)

  const roles = indiit.extractOpportunityCards(careersHtml)
  assert.equal(roles.length, 3)
  assert.deepEqual(roles[0], {
    title: 'Marketing Analyst',
    location: 'India',
    city: null,
    country: 'India',
    experienceRequired: 'Minimum 2 years of experience',
    vacancies: '2 Vacancies',
    applyUrl: indiit.SHARED_APPLY_URL,
    sourceUrl: indiit.SHARED_APPLY_URL,
    jobId: 'marketing-analyst-minimum-2-years-of-experience-2-vacancies',
  })
})

test('INDI IT SOLUTIONS falls back to a browser-backed careers page loader when Node fetch times out', async () => {
  const indiit = await loadModule()
  const requestedPrimaryUrls = []
  const requestedBrowserUrls = []

  const jobs = await indiit.createIndiItSolutionsScraper({
    now: () => '2026-08-02T11:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedPrimaryUrls.push(url)
      throw new TypeError('fetch failed | Connect Timeout Error')
    },
    fetchBrowserText: async (url) => {
      requestedBrowserUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedPrimaryUrls, [indiit.OFFICIAL_CAREERS_URL])
  assert.deepEqual(requestedBrowserUrls, [indiit.OFFICIAL_CAREERS_URL])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'indiitsolutions')
  assert.equal(jobs[0].scrapedAt, '2026-08-02T11:00:00.000Z')
})
