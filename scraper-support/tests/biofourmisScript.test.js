import { fixture, replay } from '../native-sources/declaredGreenhouse/fixtureReplay.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const loadBiofourmisModule = async () => {
  try {
    return await import('../../scraper/biofourmis/script.js')
  } catch {
    assert.fail('Expected Biofourmis scraper module at ../../scraper/biofourmis/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Openings</title>
    <link rel="canonical" href="https://www.biofourmis.com/about/job-openings" />
  </head>
  <body>
    <h1>Open Roles</h1>
    <script src="https://c27rhq.csb.app/get-jobs.js"></script>
  </body>
</html>
`

const currentOfficialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Openings</title>
    <link href="https://www.biofourmis.com/about/job-openings" rel="canonical" />
  </head>
  <body>
    <h1>Find open roles</h1>
    <a href="/about/job-openings">Find general positions</a>
    <a href="/about/clinical-job-openings">Find clinical positions</a>
  </body>
</html>
`

const loaderScript = `
const ghSlug = "biofourmis";
fetch("https://boards-api.greenhouse.io/v1/boards/" + ghSlug + "/departments/");
`

const greenhousePayload = {
  jobs: [
    {
      id: 7010101004,
      title: 'Senior Platform Engineer',
      location: { name: 'Bengaluru, Karnataka, India' },
      absolute_url: 'https://job-boards.greenhouse.io/biofourmis/jobs/7010101004',
      requisition_id: 'BF-101',
      company_name: 'Biofourmis',
      updated_at: '2026-07-14T10:00:00Z',
      content: '&lt;p&gt;Build platform services for care enablement.&lt;/p&gt;',
      departments: [{ name: 'Engineering' }],
      offices: [{ location: 'Bengaluru, Karnataka, India' }],
      metadata: [{ name: 'Employment Type', value: 'Full-time' }],
    },
    {
      id: 7010101005,
      title: 'Clinical Operations Manager',
      location: { name: 'Boston, Massachusetts, United States' },
      absolute_url: 'https://job-boards.greenhouse.io/biofourmis/jobs/7010101005',
      requisition_id: 'BF-102',
      company_name: 'Biofourmis',
      updated_at: '2026-07-14T11:00:00Z',
      content: '&lt;p&gt;US role only.&lt;/p&gt;',
      departments: [{ name: 'Operations' }],
      offices: [{ location: 'Boston, Massachusetts, United States' }],
      metadata: [{ name: 'Employment Type', value: 'Full-time' }],
    },
  ],
}

test('Biofourmis verifies the official careers page, loader script, and Greenhouse API constants', async () => {
  const biofourmis = await loadBiofourmisModule()

  assert.equal(biofourmis.CAREERS_URL, 'https://biofourmis.com/about/job-openings')
  assert.equal(biofourmis.JOBS_LOADER_URL, 'https://c27rhq.csb.app/get-jobs.js')
  assert.equal(
    biofourmis.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/biofourmis/jobs?content=true',
  )
  assert.equal(biofourmis.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(biofourmis.hasOfficialCareersSignal(currentOfficialCareersHtml), true)
  assert.equal(biofourmis.extractJobsLoaderUrl(officialCareersHtml), biofourmis.JOBS_LOADER_URL)
  assert.equal(biofourmis.hasVerifiedJobsLoaderSignal(loaderScript), true)
})

test('Biofourmis extracts India jobs from the verified Greenhouse payload', async () => {
  const biofourmis = await loadBiofourmisModule()

  const jobs = biofourmis.extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
    scrapedAt: '2026-07-14T12:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Senior Platform Engineer')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].source, 'biofourmis')
})

test('biofourmis actual factory retains complete original native models before selection',async()=>{
 const biofourmis=await loadBiofourmisModule(),r=replay(),jobs=await biofourmis.createBiofourmisScraper().run(r.options),audit=r.audits[0]
 assert.equal(audit.opening.publisherQualified,true);assert.equal(audit.closing.publisherQualified,true)
 assert.equal(audit.observations.length,fixture.oracle.biofourmis.records.length)
 for(const row of fixture.oracle.biofourmis.records){
   const job=audit.observations.find(job=>job.jobId===String(row.postId))
   assert.deepEqual(job.sourceNativeRecord,row.nativeOwnPostRecord);assert.equal(job.jobDescription,row.fullCriteriaText)
 }
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(audit.publicInventoryProof.complete,false)
 assert.ok(r.requests.indexOf(fixture.profiles.biofourmis.primaryURL)<r.requests.findIndex(url=>url.includes('/v1/boards/')))
})
