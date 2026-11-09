import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const indiaSoftwareEngineer = {
  absolute_url: 'https://www.sentinelone.com/jobs/?gh_jid=7785500003',
  company_name: 'SentinelOne',
  content: `
    <p>Build exposure-management services in Go &amp; Python.</p>
    <ul><li>Distributed systems</li><li>Cloud security</li></ul>
  `,
  departments: [{ name: '21000 Exposures Management' }],
  first_published: '2026-07-06T03:38:16-04:00',
  id: 7785500003,
  location: { name: 'Bengaluru, Karnataka, India' },
  metadata: [
    { name: 'Job Posting Department', value: 'Research & Development' },
    { name: 'Careers Page Region', value: 'Asia, Pacific & Japan' },
  ],
  requisition_id: 'On-prem-9-1',
  title: ' Software Engineer ',
  updated_at: '2026-07-17T12:44:33-04:00',
}

const nonIndiaJob = {
  ...indiaSoftwareEngineer,
  absolute_url: 'https://www.sentinelone.com/jobs/?gh_jid=7800507003',
  id: 7800507003,
  location: { name: 'United States - Remote' },
  requisition_id: '8000',
  title: 'Engineering Manager, Developer Tooling',
}

test('SentinelOne pins the official sentinellabs Greenhouse jobs endpoint', async () => {
  const sentinelOne = await loadModule()

  assert.equal(sentinelOne.SOURCE, 'sentinelone')
  assert.equal(sentinelOne.COMPANY, 'SentinelOne')
  assert.equal(sentinelOne.CAREERS_URL, 'https://www.sentinelone.com/careers/')
  assert.equal(sentinelOne.JOBS_URL, 'https://www.sentinelone.com/jobs/')
  assert.equal(sentinelOne.GREENHOUSE_BOARD_TOKEN, 'sentinellabs')
  assert.equal(
    sentinelOne.GREENHOUSE_JOBS_API_URL,
    'https://boards-api.greenhouse.io/v1/boards/sentinellabs/jobs/?content=true',
  )
})

test('SentinelOne maps only India Greenhouse jobs to complete Jobverify records', async () => {
  const { extractIndiaJobsFromGreenhousePayload } = await loadModule()

  const jobs = extractIndiaJobsFromGreenhousePayload(
    {
      jobs: [nonIndiaJob, indiaSoftwareEngineer],
      meta: { total: 2 },
    },
    { scrapedAt: '2026-07-23T10:00:00.000Z' },
  )

  assert.deepEqual(jobs, [
    {
      title: 'Software Engineer',
      company: 'SentinelOne',
      department: 'Research & Development',
      location: 'Bengaluru, Karnataka, India',
      locations: ['Bengaluru, Karnataka, India'],
      city: 'Bengaluru',
      country: 'India',
      jobId: '7785500003',
      requisitionId: 'On-prem-9-1',
      sourceUrl: 'https://www.sentinelone.com/jobs/?gh_jid=7785500003',
      applyUrl: 'https://www.sentinelone.com/jobs/?gh_jid=7785500003',
      link: 'https://www.sentinelone.com/jobs/?gh_jid=7785500003',
      source: 'sentinelone',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-06T03:38:16-04:00',
      closingDate: null,
      jobDescription: 'Build exposure-management services in Go & Python. Distributed systems Cloud security',
      remoteStatus: null,
      scrapedAt: '2026-07-23T10:00:00.000Z',
      companyCareerPage: 'https://www.sentinelone.com/careers/',
      companyDomain: 'sentinelone.com',
      atsPlatform: 'greenhouse',
    },
  ])
})

test('SentinelOne uses the first publication timestamp as the posting date', async () => {
  const { extractIndiaJobsFromGreenhousePayload } = await loadModule()

  const [job] = extractIndiaJobsFromGreenhousePayload({
    jobs: [indiaSoftwareEngineer],
    meta: { total: 1 },
  })

  assert.equal(job.postingDate, indiaSoftwareEngineer.first_published)
  assert.notEqual(job.postingDate, indiaSoftwareEngineer.updated_at)
})

test('SentinelOne leaves required skills empty until description sections can be classified', async () => {
  const { extractIndiaJobsFromGreenhousePayload } = await loadModule()
  const jobWithUnclassifiedLists = {
    ...indiaSoftwareEngineer,
    content: `
      <h2>What you will do</h2>
      <ul><li>Lead incident reviews</li></ul>
      <h2>Benefits</h2>
      <ul><li>Flexible time off</li></ul>
    `,
  }

  const [job] = extractIndiaJobsFromGreenhousePayload({
    jobs: [jobWithUnclassifiedLists],
    meta: { total: 1 },
  })

  assert.deepEqual(job.requiredSkills, [])
})

test('SentinelOne rejects truncated Greenhouse responses instead of silently dropping jobs', async () => {
  const { extractIndiaJobsFromGreenhousePayload } = await loadModule()

  assert.throws(
    () => extractIndiaJobsFromGreenhousePayload({ jobs: [indiaSoftwareEngineer], meta: { total: 2 } }),
    /total no longer matches/i,
  )
  assert.throws(
    () => extractIndiaJobsFromGreenhousePayload({ jobs: null, meta: { total: 0 } }),
    /expected payload/i,
  )
})

test('SentinelOne rejects an India job whose application URL is not the verified first-party gh_jid route', async () => {
  const { extractIndiaJobsFromGreenhousePayload } = await loadModule()
  const spoofedJob = {
    ...indiaSoftwareEngineer,
    absolute_url: 'https://example.com/jobs/7785500003',
  }

  assert.throws(
    () => extractIndiaJobsFromGreenhousePayload({ jobs: [spoofedJob], meta: { total: 1 } }),
    /first-party job URL/i,
  )
})

test('SentinelOne includes a posting whose India location is exposed only through Greenhouse offices', async () => {
  const { extractIndiaJobsFromGreenhousePayload } = await loadModule()
  const officesOnlyIndiaJob = {
    ...indiaSoftwareEngineer,
    absolute_url: 'https://www.sentinelone.com/jobs/?gh_jid=7809999003',
    id: 7809999003,
    location: { name: 'Remote' },
    offices: [
      { name: 'Bengaluru Engineering', location: 'Bengaluru, Karnataka, India' },
    ],
    requisition_id: 'REMOTE-IN-1',
    title: 'Cloud Security Engineer',
  }

  const jobs = extractIndiaJobsFromGreenhousePayload({
    jobs: [officesOnlyIndiaJob],
    meta: { total: 1 },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].location, 'Bengaluru, Karnataka, India')
  assert.deepEqual(jobs[0].locations, ['Remote', 'Bengaluru, Karnataka, India', 'Bengaluru Engineering'])
  assert.equal(jobs[0].city, 'Bengaluru')
  assert.equal(jobs[0].remoteStatus, 'Remote')
})

test('SentinelOne deduplicates repeated Greenhouse rows by job id', async () => {
  const { extractIndiaJobsFromGreenhousePayload } = await loadModule()

  const jobs = extractIndiaJobsFromGreenhousePayload({
    jobs: [indiaSoftwareEngineer, { ...indiaSoftwareEngineer }],
    meta: { total: 2 },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '7785500003')
})

test('SentinelOne run fetches the complete Greenhouse payload once and applies maxJobs after India filtering', async () => {
  const sentinelOne = await loadModule()
  const requestedUrls = []

  const jobs = await sentinelOne.createSentinelOneScraper({ maxJobs: 1 }).run({
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return {
        jobs: [nonIndiaJob, indiaSoftwareEngineer],
        meta: { total: 2 },
      }
    },
    now: () => '2026-07-23T10:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [sentinelOne.GREENHOUSE_JOBS_API_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Software Engineer')
})
