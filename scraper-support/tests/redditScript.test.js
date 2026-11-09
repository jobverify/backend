import assert from 'node:assert/strict'
import test from 'node:test'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Reddit</title>
    <link rel="canonical" href="https://redditinc.com/careers" />
  </head>
  <body>
    <main>
      <h1>Join the conversation</h1>
      <a href="#jobs">View job openings</a>
      <script>
        const countryMapping = {
          "Remote - India": "India",
          "Bangalore, India": "India",
          "": ""
        };
      </script>
      <section id="jobs">
        <a href="https://job-boards.greenhouse.io/reddit/jobs/7669372">Software Engineer, Ads Measurement</a>
        <a href="https://job-boards.greenhouse.io/reddit/jobs/7669373">Client Partner</a>
      </section>
    </main>
  </body>
</html>
`

const LIVE_GREENHOUSE_PAYLOAD_WITHOUT_INDIA = {
  jobs: [
    {
      id: 8012700,
      title: 'Acquisition Account Manager, Mid-Market EMEA',
      absolute_url: 'https://job-boards.greenhouse.io/reddit/jobs/8012700',
      updated_at: '2026-07-16T16:57:45-04:00',
      first_published: '2026-07-14T10:00:00-04:00',
      company_name: 'Reddit',
      location: { name: 'London, United Kingdom' },
      departments: [{ name: 'Sales' }],
      content: '<p>Drive EMEA account growth.</p>',
      offices: [{ location: 'London, United Kingdom' }],
    },
    {
      id: 7792848,
      title: 'Ads Conversion Modeling, Machine Learning Engineering Manager',
      absolute_url: 'https://job-boards.greenhouse.io/reddit/jobs/7792848',
      updated_at: '2026-07-15T12:00:00-04:00',
      first_published: '2026-07-10T10:00:00-04:00',
      company_name: 'Reddit',
      location: { name: 'Remote - United States' },
      departments: [{ name: 'Engineering' }],
      content: '<p>Lead ML engineering for ads conversion modeling.</p>',
      offices: [{ location: 'Remote - United States' }],
    },
  ],
}

const GREENHOUSE_PAYLOAD_WITH_INDIA = {
  jobs: [
    {
      id: 7669372,
      title: 'Software Engineer, Ads Measurement',
      absolute_url: 'https://job-boards.greenhouse.io/reddit/jobs/7669372',
      updated_at: '2026-07-16T09:00:00-04:00',
      first_published: '2026-07-12T09:00:00-04:00',
      company_name: 'Reddit',
      location: { name: 'Bangalore, India' },
      departments: [{ name: 'Engineering' }],
      content: '<p>Build measurement systems for Reddit Ads.</p>',
      offices: [{ location: 'Bangalore, India' }],
    },
    {
      id: 7669373,
      title: 'Client Partner',
      absolute_url: 'https://job-boards.greenhouse.io/reddit/jobs/7669373',
      updated_at: '2026-07-16T11:30:00-04:00',
      first_published: '2026-07-13T11:30:00-04:00',
      company_name: 'Reddit',
      location: { name: 'Remote - India' },
      departments: [{ name: 'Sales' }],
      content: '<p>Support Reddit advertisers remotely from India.</p>',
      offices: [{ location: 'Remote - India' }],
    },
    {
      id: 7669374,
      title: 'Data Scientist',
      absolute_url: 'https://job-boards.greenhouse.io/reddit/jobs/7669374',
      updated_at: '2026-07-15T08:15:00-04:00',
      first_published: '2026-07-11T08:15:00-04:00',
      company_name: 'Reddit',
      location: { name: 'Chicago, IL' },
      departments: [{ name: 'Data Science' }],
      content: '<p>US-only role.</p>',
      offices: [{ location: 'Chicago, IL' }],
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/reddit/script.js')
  } catch {
    assert.fail('Expected Reddit scraper module at ../../scraper/reddit/script.js')
  }
}

test('Reddit pins the verified first-party careers page and Greenhouse API constants', async () => {
  const reddit = await loadModule()

  assert.equal(reddit.SOURCE, 'reddit')
  assert.equal(reddit.COMPANY, 'Reddit')
  assert.equal(reddit.VERIFIED_ON, '2026-07-17')
  assert.equal(reddit.CAREERS_PAGE_URL, 'https://redditinc.com/careers')
  assert.equal(reddit.GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/reddit')
  assert.equal(
    reddit.GREENHOUSE_JOBS_API_URL,
    'https://boards-api.greenhouse.io/v1/boards/reddit/jobs?content=true',
  )
  assert.equal(reddit.hasOfficialCareersSignal(OFFICIAL_CAREERS_HTML), true)
})

test('Reddit extracts only India jobs from the verified Greenhouse payload shape', async () => {
  const reddit = await loadModule()
  const jobs = reddit.extractIndiaJobsFromGreenhousePayload(
    GREENHOUSE_PAYLOAD_WITH_INDIA,
    { scrapedAt: FIXED_SCRAPED_AT },
  )

  const expectedJobs = [
    {
      title: 'Software Engineer, Ads Measurement',
      company: 'Reddit',
      department: 'Engineering',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '7669372',
      requisitionId: '7669372',
      sourceUrl: 'https://job-boards.greenhouse.io/reddit/jobs/7669372',
      applyUrl: 'https://job-boards.greenhouse.io/reddit/jobs/7669372',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-12T09:00:00-04:00',
      closingDate: null,
      jobDescription: '<p>Build measurement systems for Reddit Ads.</p>',
      remoteStatus: 'On-site',
      source: 'reddit',
      link: 'https://job-boards.greenhouse.io/reddit/jobs/7669372',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Client Partner',
      company: 'Reddit',
      department: 'Sales',
      location: 'Remote - India',
      city: null,
      country: 'India',
      jobId: '7669373',
      requisitionId: '7669373',
      sourceUrl: 'https://job-boards.greenhouse.io/reddit/jobs/7669373',
      applyUrl: 'https://job-boards.greenhouse.io/reddit/jobs/7669373',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-13T11:30:00-04:00',
      closingDate: null,
      jobDescription: '<p>Support Reddit advertisers remotely from India.</p>',
      remoteStatus: 'Remote',
      source: 'reddit',
      link: 'https://job-boards.greenhouse.io/reddit/jobs/7669373',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ]
  // Preserve the legacy unit examples and all original mapped-field assertions.
  // Real current-source evidence is covered by the retained-native fixture tests.
  assert.deepEqual(jobs.map((job, index) => Object.fromEntries(
    Object.keys(expectedJobs[index]).map((key) => [key, job[key]]),
  )), expectedJobs)
  for (const job of jobs) {
    const original = GREENHOUSE_PAYLOAD_WITH_INDIA.jobs.find((row) => String(row.id) === job.jobId)
    assert.deepEqual(job.sourceNativeRecord, original)
    assert.notEqual(job.sourceNativeRecord, original)
    assert.equal(job.sourceNativeContent, original.content)
    assert.equal(job.sourceFirstPublished, original.first_published)
    assert.equal(job.sourceUpdatedAt, original.updated_at)
    assert.equal(job.sourceNativeMetadata, null)
    assert.equal(job.legalHiringEmployer, null)
    assert.equal(job.sourceCriteriaReviewComplete, false)
  }
})

test('Reddit keeps an empty India slice incomplete when the legacy unit payload has no India roles', async () => {
  const reddit = await loadModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await reddit.createRedditScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      return OFFICIAL_CAREERS_HTML
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      return LIVE_GREENHOUSE_PAYLOAD_WITHOUT_INDIA
    },
  })

  assert.deepEqual(requestedTextUrls, [reddit.CAREERS_PAGE_URL])
  assert.deepEqual(requestedJsonUrls, [reddit.GREENHOUSE_JOBS_API_URL])
  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
})

test('Reddit fails closed when the official careers page or Greenhouse payload drifts away from the verified contract', async () => {
  const reddit = await loadModule()

  await assert.rejects(
    reddit.createRedditScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
      fetchJson: async () => LIVE_GREENHOUSE_PAYLOAD_WITHOUT_INDIA,
    }),
    /verified official reddit careers page/i,
  )

  await assert.rejects(
    reddit.createRedditScraper().run({
      fetchText: async () => OFFICIAL_CAREERS_HTML,
      fetchJson: async () => ({
        jobs: [
          {
            id: 1,
            title: 'Broken Job',
            absolute_url: 'https://jobs.example.com/1',
            company_name: 'Reddit',
            location: { name: 'Bangalore, India' },
          },
        ],
      }),
    }),
    /verified reddit native URL changed materially/i,
  )
})
