import assert from 'node:assert/strict'
import test from 'node:test'

const loadCatalog = async () => import('../../scraper/easternsoftwaresolutionspvtltd/catalog.js')
const loadScript = async () => import('../../scraper/easternsoftwaresolutionspvtltd/script.js')

const careersHtml = `
<!doctype html>
<html>
  <head><title>Explore Careers at Eastern Software Solutions</title></head>
  <body>
    <h1>Find Your Next Job</h1>
    <p>Job Related Queries</p>
    <a href="https://www.essindia.com/apply-now.php?post_name=Sales Executive" class="job-list">
      <div class="content col">
        <h6 class="title">Sales Executive</h6>
        <ul class="meta">
          <li><strong class="text-primary">EssIndia</strong></li>
          <li>Noida, Uttar Pradesh, India</li>
        </ul>
      </div>
    </a>
  </body>
</html>
`

test('Eastern Software Solutions Pvt. Ltd catalog captures the verified first-party careers contract', async () => {
  const { EASTERN_SOFTWARE_SOLUTIONS_PVT_LTD_CATALOG } = await loadCatalog()

  assert.equal(EASTERN_SOFTWARE_SOLUTIONS_PVT_LTD_CATALOG.source, 'easternsoftwaresolutionspvtltd')
  assert.equal(EASTERN_SOFTWARE_SOLUTIONS_PVT_LTD_CATALOG.companyCareerPage, 'https://www.essindia.com/careers.php')
  assert.equal(EASTERN_SOFTWARE_SOLUTIONS_PVT_LTD_CATALOG.atsPlatform, 'official-company-site-job-list')
  assert.match(EASTERN_SOFTWARE_SOLUTIONS_PVT_LTD_CATALOG.verifiedSurfaceSummary, /Sales Executive/i)
})

test('Eastern Software Solutions Pvt. Ltd extracts the first-party job list card', async () => {
  const ess = await loadScript()

  assert.equal(ess.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(ess.extractJobCards(careersHtml), [
    {
      title: 'Sales Executive',
      location: 'Noida, Uttar Pradesh, India',
      city: 'Noida',
      country: 'India',
      sourceUrl: 'https://www.essindia.com/apply-now.php?post_name=Sales%20Executive',
      applyUrl: 'https://www.essindia.com/apply-now.php?post_name=Sales%20Executive',
      employmentType: 'Full Time',
      experienceRequired: null,
      jobDescription: 'EssIndia Noida, Uttar Pradesh, India',
      requiredSkills: [],
    },
  ])
})

test('Eastern Software Solutions Pvt. Ltd run normalizes jobs and fails closed on drift', async () => {
  const ess = await loadScript()

  const jobs = await ess.run({
    fetchText: async () => careersHtml,
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'sales-executive')
  assert.equal(jobs[0].source, 'easternsoftwaresolutionspvtltd')
  assert.equal(jobs[0].scrapedAt, '2026-07-18T00:00:00.000Z')

  await assert.rejects(
    ess.run({ fetchText: async () => '<html><body>Unexpected</body></html>' }),
    /verified eastern software solutions careers page/i,
  )
})
