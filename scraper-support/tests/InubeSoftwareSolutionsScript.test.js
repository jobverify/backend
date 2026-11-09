import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-02T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - iNube</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>View all 0penings</p>
      <div class="awsm-job-listings awsm-row awsm-grid-col-3" data-listings="2">
        <div class="awsm-job-listing-item awsm-grid-item" id="awsm-grid-item-74380">
          <a href="https://www.inubesolutions.com/jobs/senior-business-analyst/" class="awsm-job-item">
            <div class="awsm-grid-left-col">
              <h2 class="awsm-job-post-title">Senior Business Analyst&nbsp;</h2>
            </div>
            <div class="awsm-grid-right-col">
              <div class="awsm-job-specification-wrapper">
                <div class="awsm-job-specification-item awsm-job-specification-job-category"><span class="awsm-job-specification-term">Insurance Practice</span></div>
                <div class="awsm-job-specification-item awsm-job-specification-job-type"><span class="awsm-job-specification-term">Full Time</span></div>
                <div class="awsm-job-specification-item awsm-job-specification-job-location"><span class="awsm-job-specification-term">Bangalore</span></div>
              </div>
            </div>
          </a>
        </div>
        <div class="awsm-job-listing-item awsm-grid-item" id="awsm-grid-item-74370">
          <a href="https://www.inubesolutions.com/jobs/associate-project-manager/" class="awsm-job-item">
            <div class="awsm-grid-left-col">
              <h2 class="awsm-job-post-title">Associate Project Manager:</h2>
            </div>
            <div class="awsm-grid-right-col">
              <div class="awsm-job-more-container"><span class="awsm-job-more">More Details</span></div>
            </div>
          </a>
        </div>
      </div>
    </main>
  </body>
</html>
`

const seniorBusinessAnalystHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Senior Business Analyst</h1>
      <p>Location: Bangalore Roles and responsibilities:</p>
      <ul>
        <li>Drive requirement discovery and business analysis for insurance products</li>
        <li>Coordinate with customer and delivery teams on change requests</li>
      </ul>
      <h2>Qualifications, Work experience:</h2>
      <p>Strong insurance domain knowledge.</p>
    </main>
  </body>
</html>
`

const associateProjectManagerHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Associate Project Manager:</h1>
      <p>Location: Bangalore Main responsibilities and Opportunities:</p>
      <h2>Key Responsibilities:</h2>
      <ul>
        <li>Manage delivery timelines across AI and insurance product workstreams</li>
        <li>Prepare project plans and status reviews during the engagement lifecycle</li>
      </ul>
      <h2>Qualifications, work experience:</h2>
      <p>4-5 years of experience in project coordination or management, preferably in AI/ML projects.</p>
      <ul>
        <li>Project Management</li>
        <li>Jira</li>
      </ul>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/inubesoftwaresolutions/script.js')
  } catch {
    assert.fail('Expected Inube Software Solutions scraper module at ../../scraper/inubesoftwaresolutions/script.js')
  }
}

test('Inube Software Solutions helpers stay pinned to the verified jobs archive and detail pages', async () => {
  const inube = await loadModule()

  assert.equal(inube.SOURCE, 'inubesoftwaresolutions')
  assert.equal(inube.COMPANY, 'Inube Software Solutions')
  assert.equal(inube.CAREERS_URL, 'https://inubesolutions.com/careers-inube/')
  assert.equal(inube.VERIFIED_ON, '2026-08-02')
  assert.equal(inube.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(inube.hasOfficialCareersSignal('<html><body><h1>Jobs</h1></body></html>'), false)
  assert.deepEqual(inube.extractRoleSummaries(careersHtml), [
    {
      title: 'Senior Business Analyst',
      detailUrl: 'https://www.inubesolutions.com/jobs/senior-business-analyst/',
      department: 'Insurance Practice',
      employmentType: 'Full Time',
      locations: ['Bangalore'],
    },
    {
      title: 'Associate Project Manager',
      detailUrl: 'https://www.inubesolutions.com/jobs/associate-project-manager/',
      department: null,
      employmentType: null,
      locations: [],
    },
  ])

  const seniorBusinessAnalyst = inube.extractRoleDetail(
    seniorBusinessAnalystHtml,
    inube.extractRoleSummaries(careersHtml)[0],
  )
  assert.equal(seniorBusinessAnalyst.location, 'Bangalore, India')
  assert.equal(seniorBusinessAnalyst.remoteStatus, null)
  assert.equal(seniorBusinessAnalyst.experienceRequired, null)

  const associateProjectManager = inube.extractRoleDetail(
    associateProjectManagerHtml,
    inube.extractRoleSummaries(careersHtml)[1],
  )
  assert.equal(associateProjectManager.title, 'Associate Project Manager')
  assert.equal(associateProjectManager.location, 'Bangalore, India')
  assert.equal(associateProjectManager.experienceRequired, '4-5 years')
})

test('Inube Software Solutions run validates the verified archive before hydrating detail pages', async () => {
  const inube = await loadModule()
  const requestedUrls = []

  const jobs = await inube.createInubeSoftwareSolutionsScraper().run({
    now: () => FIXED_SCRAPED_AT,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === inube.CAREERS_URL) return careersHtml
      if (url === 'https://www.inubesolutions.com/jobs/senior-business-analyst/') return seniorBusinessAnalystHtml
      if (url === 'https://www.inubesolutions.com/jobs/associate-project-manager/') return associateProjectManagerHtml
      throw new Error(`Unexpected iNube URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    inube.CAREERS_URL,
    'https://www.inubesolutions.com/jobs/senior-business-analyst/',
    'https://www.inubesolutions.com/jobs/associate-project-manager/',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'inubesoftwaresolutions')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[1].title, 'Associate Project Manager')
})

test('Inube Software Solutions validates the official archive when advertised roles change', async () => {
  const inube = await loadModule()
  const updatedCareersHtml = careersHtml
    .replace(/Senior Business Analyst/g, 'Support Lead')
    .replace(/senior-business-analyst/g, 'support-lead')
    .replace(/Associate Project Manager/g, 'Senior Software Engineer')
    .replace(/associate-project-manager/g, 'senior-software-engineer')

  assert.equal(inube.hasOfficialCareersSignal(updatedCareersHtml), true)
  assert.equal(inube.hasOfficialCareersSignal(updatedCareersHtml.replace('0penings', 'Openings')), true)
  assert.equal(inube.hasOfficialCareersSignal(updatedCareersHtml.replace(/www\.inubesolutions\.com/g, 'unrelated.example')), false)
  assert.equal(inube.hasOfficialCareersSignal(updatedCareersHtml.replace('Careers - iNube', 'Careers - Other Company')), false)
  assert.equal(inube.hasOfficialCareersSignal(updatedCareersHtml.replace('awsm-job-listings ', '')), false)
})

test('Inube Software Solutions run fails closed when the verified jobs archive drifts', async () => {
  const inube = await loadModule()

  await assert.rejects(
    inube.createInubeSoftwareSolutionsScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified inube software solutions careers surface/i,
  )
})
