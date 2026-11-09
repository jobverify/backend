import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const loadTenableModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Tenable scraper module at ./script.js')
  }
}

const loadTenableCatalog = async () => {
  try {
    return await import('./catalog.js')
  } catch {
    assert.fail('Expected Tenable provider metadata at ./catalog.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Tenable®</title>
    <link rel="canonical" href="https://www.tenable.com/careers" />
  </head>
  <body>
    <h1>Do work<br><mark>that matters</mark></h1>
    <a href="/careers/search"><span>Search jobs</span></a>
    <a href="https://boards.greenhouse.io/tenableinc/jobs/4019356008">View openings</a>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 5116064008,
      title: 'Senior Security Consultant',
      company_name: 'Tenable, Inc.',
      location: { name: 'India - Remote - Mumbai' },
      absolute_url: 'https://job-boards.greenhouse.io/tenableinc/jobs/5116064008',
      requisition_id: 'R0006001',
      first_published: '2026-07-20T10:00:00-04:00',
      updated_at: '2026-07-21T11:00:00-04:00',
      application_deadline: null,
      content: '&lt;p&gt;Bring 5+ years of consulting experience.&lt;/p&gt;',
      departments: [{ name: 'Consulting' }],
      offices: [{ name: 'India', location: null }],
      metadata: [
        { name: 'Category (For Website Only)', value: 'Professional Services' },
        { name: 'Job Posting Location', value: ['India - Remote - Mumbai'] },
        { name: 'Country (For Website Only)', value: ['India'] },
      ],
    },
    {
      id: 5360000008,
      title: 'Sales Development Representative',
      company_name: 'Tenable, Inc.',
      location: { name: 'India - Remote - Mumbai , India - Remote - Delhi' },
      absolute_url: 'https://boards.greenhouse.io/tenableinc/jobs/5360000008?gh_jid=5360000008',
      requisition_id: 'R0006002',
      first_published: '2026-07-22T09:00:00-04:00',
      content: '&lt;p&gt;This is a remote role supporting India.&lt;/p&gt;',
      departments: [{ name: 'Sales Development' }],
      offices: [],
      metadata: [
        { name: 'Job Posting Location', value: ['India - Remote - Mumbai', 'India - Remote - Delhi'] },
        { name: 'Country (For Website Only)', value: ['India'] },
      ],
    },
    {
      id: 5360001008,
      title: 'Regional Customer Success Manager',
      company_name: 'Tenable, Inc.',
      location: { name: 'Remote' },
      absolute_url: 'https://job-boards.greenhouse.io/tenableinc/jobs/5360001008',
      requisition_id: 'R0006003',
      first_published: '2026-07-22T12:00:00-04:00',
      content: '&lt;p&gt;Partner with customers in a hybrid working model.&lt;/p&gt;',
      departments: [{ name: 'Customer Success' }],
      offices: [],
      metadata: [
        { name: 'Job Posting Location', value: ['India - Remote - Bengaluru'] },
        { name: 'Country (For Website Only)', value: ['India'] },
      ],
    },
    {
      id: 5360002008,
      title: 'India Partner Engineer',
      company_name: 'Tenable, Inc.',
      location: { name: 'APAC Remote' },
      absolute_url: 'https://job-boards.greenhouse.io/tenableinc/jobs/5360002008',
      requisition_id: 'R0006004',
      first_published: '2026-07-23T08:00:00-04:00',
      content: '&lt;p&gt;Work with partners from Bengaluru.&lt;/p&gt;',
      departments: [{ name: 'Engineering' }],
      offices: [{ name: 'India', location: 'Bengaluru, Karnataka, India' }],
      metadata: [],
    },
    {
      id: 5288748008,
      title: 'Commercial Territory Manager',
      company_name: 'Tenable, Inc.',
      location: { name: 'US - Remote - Massachusetts - Boston' },
      absolute_url: 'https://job-boards.greenhouse.io/tenableinc/jobs/5288748008',
      requisition_id: 'R0006382',
      first_published: '2026-07-01T13:15:29-04:00',
      content: '&lt;p&gt;US commercial sales role.&lt;/p&gt;',
      departments: [{ name: 'Commercial Sales' }],
      offices: [],
      metadata: [{ name: 'Country (For Website Only)', value: ['United States of America'] }],
    },
    {
      id: 5301949008,
      title: 'Territory Account Manager - SLED',
      company_name: 'Tenable, Inc.',
      location: { name: 'US - Remote - Indiana' },
      absolute_url: 'https://job-boards.greenhouse.io/tenableinc/jobs/5301949008',
      requisition_id: 'R0006383',
      first_published: '2026-07-02T13:15:29-04:00',
      content: '&lt;p&gt;US role.&lt;/p&gt;',
      departments: [{ name: 'Territory Management' }],
      offices: [],
      metadata: [{ name: 'Country (For Website Only)', value: ['United States of America'] }],
    },
  ],
}

test('Tenable pins the verified first-party careers handoff and official Greenhouse board API', async () => {
  const tenable = await loadTenableModule()

  assert.equal(tenable.SOURCE, 'tenable')
  assert.equal(tenable.COMPANY, 'Tenable')
  assert.equal(tenable.CAREERS_URL, 'https://www.tenable.com/careers')
  assert.equal(tenable.JOB_SEARCH_URL, 'https://www.tenable.com/careers/search')
  assert.equal(tenable.FIRST_PARTY_JOBS_API_URL, 'https://www.tenable.com/evaluations/api/v1/jobs')
  assert.equal(tenable.GREENHOUSE_BOARD_ID, 'tenableinc')
  assert.equal(tenable.GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/tenableinc')
  assert.equal(
    tenable.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/tenableinc/jobs?content=true',
  )
  assert.equal(tenable.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(tenable.extractOfficialJobSearchUrl(officialCareersHtml), tenable.JOB_SEARCH_URL)
  assert.equal(tenable.extractGreenhouseBoardId(officialCareersHtml), 'tenableinc')
  assert.equal(
    tenable.normalizeGreenhouseJobUrl(
      'https://boards.greenhouse.io/tenableinc/jobs/5360000008?gh_jid=5360000008',
      5360000008,
    ),
    'https://job-boards.greenhouse.io/tenableinc/jobs/5360000008',
  )
})

test('Tenable extracts every India opening using location, country metadata, and office evidence', async () => {
  const tenable = await loadTenableModule()
  const jobs = tenable.extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
    scrapedAt: '2026-07-23T12:00:00.000Z',
  })

  assert.equal(jobs.length, 4)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      country: job.country,
      department: job.department,
      remoteStatus: job.remoteStatus,
      sourceUrl: job.sourceUrl,
    })),
    [
      {
        title: 'Senior Security Consultant',
        location: 'India - Remote - Mumbai',
        city: 'Mumbai',
        country: 'India',
        department: 'Consulting',
        remoteStatus: 'Remote',
        sourceUrl: 'https://job-boards.greenhouse.io/tenableinc/jobs/5116064008',
      },
      {
        title: 'Sales Development Representative',
        location: 'India - Remote - Mumbai , India - Remote - Delhi',
        city: 'Mumbai',
        country: 'India',
        department: 'Sales Development',
        remoteStatus: 'Remote',
        sourceUrl: 'https://job-boards.greenhouse.io/tenableinc/jobs/5360000008',
      },
      {
        title: 'Regional Customer Success Manager',
        location: 'India - Remote - Bengaluru',
        city: 'Bangalore',
        country: 'India',
        department: 'Customer Success',
        remoteStatus: 'Hybrid',
        sourceUrl: 'https://job-boards.greenhouse.io/tenableinc/jobs/5360001008',
      },
      {
        title: 'India Partner Engineer',
        location: 'Bengaluru, Karnataka, India',
        city: 'Bangalore',
        country: 'India',
        department: 'Engineering',
        remoteStatus: 'Remote',
        sourceUrl: 'https://job-boards.greenhouse.io/tenableinc/jobs/5360002008',
      },
    ],
  )

  assert.equal(jobs[0].jobId, '5116064008')
  assert.equal(jobs[0].requisitionId, 'R0006001')
  assert.equal(jobs[0].experienceRequired, '5+ years')
  assert.equal(jobs[0].postingDate, '2026-07-20T10:00:00-04:00')
  assert.equal(jobs[0].closingDate, null)
  assert.equal(jobs[0].jobDescription, 'Bring 5+ years of consulting experience.')
  assert.equal(jobs[0].source, 'tenable')
  assert.equal(jobs[0].scrapedAt, '2026-07-23T12:00:00.000Z')

  assert.equal(
    jobs.some((job) => job.title === 'Commercial Territory Manager'),
    false,
    'a same-title US opening must not make the user-listed India role look live',
  )
})

test('Tenable accepts a healthy live feed with no current India openings', async () => {
  const tenable = await loadTenableModule()

  const jobs = tenable.extractIndiaJobsFromGreenhousePayload({
    jobs: [greenhousePayload.jobs[4], greenhousePayload.jobs[5]],
  })

  assert.deepEqual(jobs, [])
})

test('Tenable rejects India country metadata with a foreign-only location', async () => {
  const tenable = await loadTenableModule()
  for (const foreignLocation of ['US - Remote - Massachusetts - Boston', 'Warsaw, Poland']) {
    const contradictoryJob = {
      ...greenhousePayload.jobs[4],
      location: { name: foreignLocation },
      metadata: [{ name: 'Country (For Website Only)', value: ['India'] }],
    }

    const jobs = tenable.extractIndiaJobsFromGreenhousePayload({ jobs: [contradictoryJob] })
    assert.deepEqual(jobs, [])
  }

  const deduplicated = tenable.extractIndiaJobsFromGreenhousePayload({
    jobs: [greenhousePayload.jobs[0], greenhousePayload.jobs[0]],
  })
  assert.equal(deduplicated.length, 1)
})

test('Tenable registered run rejects legacy body-only transports', async () => {
  const tenable = await loadTenableModule()
  await assert.rejects(tenable.createTenableScraper().run({fetchText: async () => officialCareersHtml, fetchJson: async () => greenhousePayload}), /body-only transport is unsupported/)
})

test('Tenable fails closed on first-party, payload, company, and job-URL drift', async () => {
  const tenable = await loadTenableModule()

  await assert.rejects(
    tenable.createTenableScraper().run({
      fetchText: async () => '<html><title>Careers</title></html>',
      fetchJson: async () => greenhousePayload,
    }),
    /body-only transport is unsupported/i,
  )

  assert.throws(
    () => tenable.extractIndiaJobsFromGreenhousePayload({ jobs: null }),
    /expected jobs array/i,
  )

  assert.throws(
    () => tenable.extractIndiaJobsFromGreenhousePayload({
      jobs: [{ ...greenhousePayload.jobs[0], company_name: 'Imposter, Inc.' }],
    }),
    /company identity/i,
  )

  assert.throws(
    () => tenable.extractIndiaJobsFromGreenhousePayload({
      jobs: [{
        ...greenhousePayload.jobs[0],
        absolute_url: 'https://job-boards.greenhouse.io/other-company/jobs/5116064008',
      }],
    }),
    /job detail URL/i,
  )
})

test('Tenable local catalog exposes registration metadata without hard-coding a posting', async () => {
  const { TENABLE_CATALOG, default: defaultCatalog } = await loadTenableCatalog()

  assert.equal(defaultCatalog, TENABLE_CATALOG)
  assert.equal(TENABLE_CATALOG.source, 'tenable')
  assert.equal(TENABLE_CATALOG.companyName, 'Tenable')
  assert.equal(TENABLE_CATALOG.adapter, 'script')
  assert.equal(TENABLE_CATALOG.companyCareerPage, 'https://www.tenable.com/careers')
  assert.equal(TENABLE_CATALOG.companyDomain, 'tenable.com')
  assert.equal(TENABLE_CATALOG.atsPlatform, 'greenhouse-board-api')
  assert.equal(TENABLE_CATALOG.countryFilter, 'India')
  assert.equal(TENABLE_CATALOG.paginationStrategy, 'single-greenhouse-board-feed')
  assert.equal(TENABLE_CATALOG.greenhouseBoardId, 'tenableinc')
  assert.equal(
    TENABLE_CATALOG.greenhouseJobsApiUrl,
    'https://boards-api.greenhouse.io/v1/boards/tenableinc/jobs?content=true',
  )
  assert.equal(
    TENABLE_CATALOG.firstPartyJobsApiUrl,
    'https://www.tenable.com/evaluations/api/v1/jobs',
  )
  assert.equal(TENABLE_CATALOG.verifiedOn, '2026-07-23')
  assert.equal(TENABLE_CATALOG.modulePath, path.join(currentDir, 'script.js'))
  assert.match(TENABLE_CATALOG.verifiedSurfaceSummary, /zero India openings/i)
  assert.match(TENABLE_CATALOG.verifiedSurfaceSummary, /Commercial Territory Manager/i)
})
