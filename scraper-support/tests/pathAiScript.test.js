import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-25T00:00:00.000Z'

const verifiedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers</title>
  </head>
  <body>
    <main>
      <h1>Join our team.</h1>
      <p>A new path is waiting.</p>
      <ul>
        <li><a href="#OpenPositions">Open Positions</a></li>
      </ul>
      <div id="OpenPositions" class="resource-grid-wrapper">
        <h2>Open Positions</h2>
        <span class="selected-text">All Locations</span>
        <span class="selected-text">All Departments</span>
        <div class="resource-grid pad-xl" id="resourceGrid"></div>
      </div>
    </main>
    <footer>
      <p>Copyright © 2026 PathAI, Inc.</p>
    </footer>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      absolute_url: 'https://www.pathai.com/careers/8466724002?gh_jid=8466724002',
      id: 8466724002,
      requisition_id: 'BF-2026-25',
      title: 'Software Engineer I, Fullstack',
      company_name: 'PathAI',
      first_published: '2026-03-17T15:31:05-04:00',
      updated_at: '2026-07-15T12:39:32-04:00',
      content: '&lt;p&gt;Build new features for internal and external users.&lt;/p&gt;',
      location: { name: 'Boston, MA (Hybrid)' },
      departments: [{ name: 'Engineering' }],
      offices: [{ location: 'Boston, Massachusetts, United States' }],
      metadata: [
        { name: 'Location options', value: ['Boston', 'Remote'] },
      ],
    },
    {
      absolute_url: 'https://www.pathai.com/careers/8308240002?gh_jid=8308240002',
      id: 8308240002,
      requisition_id: 'BF-2025-94',
      title: 'Associate Director, MLOps Engineering',
      company_name: 'PathAI',
      first_published: '2025-12-01T15:45:08-05:00',
      updated_at: '2026-04-22T17:22:12-04:00',
      content: '&lt;p&gt;Lead the team responsible for the backbone of our AI/ML stack.&lt;/p&gt;',
      location: { name: 'Boston (Onsite) Preferred, New York (Onsite), or Remote' },
      departments: [{ name: 'Machine Learning' }],
      offices: [
        { location: 'Boston, Massachusetts, United States' },
        { location: 'New York, New York, United States' },
      ],
      metadata: [
        { name: 'Location options', value: ['Boston', 'New York', 'Remote'] },
      ],
    },
    {
      absolute_url: 'https://www.pathai.com/careers/8282600002?gh_jid=8282600002',
      id: 8282600002,
      requisition_id: 'N-2025-91',
      title: 'Implementation Engineer, Digital Diagnostics (DDx), Europe',
      company_name: 'PathAI',
      first_published: '2025-11-10T12:26:09-05:00',
      updated_at: '2026-04-22T17:22:12-04:00',
      content: '&lt;p&gt;Support European digital diagnostics customers.&lt;/p&gt;',
      location: { name: 'EU Based' },
      departments: [{ name: 'Customer Operations' }],
      offices: [{ name: 'European Union', location: null }],
      metadata: [
        { name: 'Location options', value: ['Other', 'Remote'] },
      ],
    },
  ],
  meta: {
    total: 9,
  },
}

const loadPathAiModule = async () => {
  try {
    return await import('../../scraper/pathai/script.js')
  } catch {
    assert.fail('Expected PathAI scraper module at ../../scraper/pathai/script.js')
  }
}

test('PathAI pins the verified first-party careers page and first-party Greenhouse API constants', async () => {
  const pathAi = await loadPathAiModule()

  assert.equal(pathAi.SOURCE, 'pathai')
  assert.equal(pathAi.COMPANY_NAME, 'PathAI')
  assert.equal(pathAi.CAREERS_URL, 'https://www.pathai.com/careers')
  assert.equal(pathAi.GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/pathai')
  assert.equal(
    pathAi.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/pathai/jobs?content=true',
  )
  assert.equal(pathAi.hasOfficialCareersPageSignal(verifiedCareersHtml), true)
  assert.equal(
    pathAi.normalizePathAiJobUrl(
      'https://www.pathai.com/careers/8466724002?gh_jid=8466724002&utm_source=board',
      8466724002,
    ),
    'https://www.pathai.com/careers/8466724002?gh_jid=8466724002',
  )
})

test('PathAI registered run retains all originals and treats unresolved India scope as discovery, never employer zero', async () => {
  const pathAi = await loadPathAiModule()
  assert.deepEqual(pathAi.extractIndiaJobsFromGreenhousePayload(greenhousePayload, { scrapedAt: FIXED_SCRAPED_AT }), [])
  const { fixture, replay } = await import('../native-sources/declaredGreenhouseRoutes/fixtureReplay.js')
  const { readInventoryEvidence } = await import('../utils/inventoryEvidence.js')
  const r = replay(), jobs = await pathAi.createPathAiScraper().run(r.options)
  assert.equal(r.audits[0].observations.length, 10)
  assert.deepEqual(jobs.map(job => job.jobId), fixture.oracle.pathai.records.filter(row => row.indiaCandidate).map(row => row.id))
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('PathAI holds a changed current publisher while preserving all complete native observations', async () => {
  const pathAi = await loadPathAiModule()
  const { fixture, replay, editJSON } = await import('../native-sources/declaredGreenhouseRoutes/fixtureReplay.js')
  const p = fixture.profiles.pathai
  const r = replay((url, page, visit) => url === p.publicAPIBase && visit === 2 ? editJSON(page, value => { value.name = 'Other Company' }) : page)
  const jobs = await pathAi.createPathAiScraper().run(r.options)
  assert.equal(jobs.length, 0)
  assert.equal(r.audits[0].observations.length, 10)
  assert.ok(r.audits[0].observations.every(job => job.jobDescription && !job.sourceCurrentNativePostingIdentityQualified))
  await assert.rejects(pathAi.createPathAiScraper().run({ fetchJson: r.options.fetchJson }), /original HTTP/)
})
