import assert from 'node:assert/strict'
import test from 'node:test'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

import {
  CAREERS_URL,
  GREENHOUSE_BOARD_URL,
  GREENHOUSE_JOBS_API_URL,
  SOURCE,
  buildGreenhouseJobsApiUrl,
  createSigmaComputingScraper,
  extractIndiaJobsFromGreenhousePayload,
  hasOfficialCareersPageSignal,
  normalizeGreenhouseJobUrl,
} from './script.js'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers and Open Positions | Sigma</title>
  </head>
  <body>
    <main>
      <h1>Careers at Sigma</h1>
      <p>Help us build the future of AI, data apps, and analytics.</p>
      <button>View open positions</button>
      <section>
        <h2>Open Roles</h2>
        <a href="https://job-boards.greenhouse.io/sigmacomputing/jobs/7767894003">
          Business Development Representative New York City, NY READ MORE
        </a>
        <a href="https://job-boards.greenhouse.io/sigmacomputing/jobs/7767895003">
          Enterprise Account Executive (AUS) Australia READ MORE
        </a>
      </section>
    </main>
  </body>
</html>
`

test('Sigma Computing constants and official careers page validation match the verified public surface', () => {
  assert.equal(SOURCE, 'sigmacomputing')
  assert.equal(CAREERS_URL, 'https://www.sigmacomputing.com/company/careers')
  assert.equal(GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/sigmacomputing')
  assert.equal(GREENHOUSE_JOBS_API_URL, 'https://boards-api.greenhouse.io/v1/boards/sigmacomputing/jobs')
  assert.equal(
    buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/sigmacomputing/jobs?content=true',
  )
  assert.equal(hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(hasOfficialCareersPageSignal('<html><body><h1>Sigma jobs</h1></body></html>'), false)
  assert.equal(
    normalizeGreenhouseJobUrl(
      'https://job-boards.greenhouse.io/sigmacomputing/jobs/9876543210?gh_src=ref',
      '9876543210',
    ),
    'https://job-boards.greenhouse.io/sigmacomputing/jobs/9876543210',
  )
})

test('Sigma Computing Greenhouse extraction keeps only India jobs and maps canonical detail URLs', () => {
  const payload = {
    jobs: [
      {
        id: 111,
        title: 'Senior Software Engineer - Backend',
        company_name: 'Sigma Computing',
        absolute_url: 'https://job-boards.greenhouse.io/sigmacomputing/jobs/111',
        location: { name: 'San Francisco, CA' },
        departments: [{ name: 'Engineering' }],
        updated_at: '2026-07-25T08:00:00Z',
        content: '<p>Non-India role.</p>',
      },
      {
        id: 222,
        title: 'Solutions Engineer',
        company_name: 'Sigma Computing',
        absolute_url: 'https://job-boards.greenhouse.io/sigmacomputing/jobs/222',
        location: { name: 'Bengaluru, India' },
        departments: [{ name: 'Solutions Engineering' }],
        requisition_id: 'REQ-222',
        updated_at: '2026-07-25T09:00:00Z',
        content: '<p>Help customers deploy Sigma.</p>',
      },
    ],
  }
  const jobs = extractIndiaJobsFromGreenhousePayload(payload, { scrapedAt: '2026-07-25T10:00:00.000Z' })

  assert.deepEqual(jobs, [{
    title: 'Solutions Engineer',
    company: 'Sigma Computing',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    link: 'https://job-boards.greenhouse.io/sigmacomputing/jobs/222',
    applyUrl: 'https://job-boards.greenhouse.io/sigmacomputing/jobs/222',
    sourceUrl: 'https://job-boards.greenhouse.io/sigmacomputing/jobs/222',
    source: 'sigmacomputing',
    jobId: '222',
    requisitionId: 'REQ-222',
    department: 'Solutions Engineering',
    employmentType: null,
    sourcePublisher: 'Sigma Computing',
    legalHiringEmployer: null,
    sourceFirstPublished: null,
    sourceUpdatedAt: '2026-07-25T09:00:00Z',
    sourceNativeEducation: null,
    sourceNativeMetadata: null,
    sourceNativeRecord: payload.jobs[1],
    sourceNativeContent: '<p>Help customers deploy Sigma.</p>',
    sourceNativeRequisitionId: 'REQ-222',
    sourceCriteriaIssues: ['unreviewed-native-metadata'],
    sourceCriteriaSchemaKnown: false,
    experienceRequired: null,
    jobDescription: '<p>Help customers deploy Sigma.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    // This original unit fixture has no first_published field. Its edit time
    // cannot supply a publication date; real historical dates are covered by
    // nativeCriteria.test.js against all77 untouched original records.
    postingDate: null,
    closingDate: null,
    scrapedAt: '2026-07-25T10:00:00.000Z',
  }])
})

test('Sigma Computing scraper returns an honest empty India slice when the verified feed has no India roles', async () => {
  const jobs = await createSigmaComputingScraper().run({
    fetchText: async (url) => {
      assert.equal(url, CAREERS_URL)
      return careersHtml
    },
    fetchJson: async (url) => {
      assert.equal(url, 'https://boards-api.greenhouse.io/v1/boards/sigmacomputing/jobs?content=true')
      return {
        jobs: [
          {
            id: 1,
            title: 'Business Development Representative',
            company_name: 'Sigma Computing',
            absolute_url: 'https://job-boards.greenhouse.io/sigmacomputing/jobs/1',
            location: { name: 'New York City, NY' },
            content: '<p>Build pipeline.</p>',
          },
          {
            id: 2,
            title: 'Enterprise Account Executive (AUS)',
            company_name: 'Sigma Computing',
            absolute_url: 'https://job-boards.greenhouse.io/sigmacomputing/jobs/2',
            location: { name: 'Australia' },
            content: '<p>Own ANZ territory.</p>',
          },
        ],
      }
    },
    now: () => '2026-07-25T10:00:00.000Z',
  })

  assert.deepEqual(jobs, [])
  const evidence=readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete,false)
  assert.equal(evidence.reportedTotal,null)
  assert.equal(evidence.indiaFacetCount,null)
  assert.equal(jobs.sourceAudit.lifecycleCleanupAllowed,false)
})

test('Sigma Computing scraper fails closed when the verified first-party page or Greenhouse identity changes', async () => {
  await assert.rejects(
    createSigmaComputingScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected page</h1></body></html>',
      fetchJson: async () => ({ jobs: [] }),
    }),
    /verified official careers page/i,
  )

  assert.throws(
    () => extractIndiaJobsFromGreenhousePayload({
      jobs: [{
        id: 3,
        title: 'Solutions Engineer',
        company_name: 'Someone Else',
        absolute_url: 'https://job-boards.greenhouse.io/sigmacomputing/jobs/3',
        location: { name: 'Bengaluru, India' },
      }],
    }),
    /Sigma Computing native identity changed materially/,
  )
})
