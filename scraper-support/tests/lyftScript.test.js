import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title data-next-head="">Lyft Careers</title>
    <link rel="canonical" href="https://www.lyft.com/careers" data-testid="canonical-link" data-next-head="" />
  </head>
  <body>
    <main>
      <p>WORKING AT LYFT</p>
      <h1>Building a more connected world, ride by ride.</h1>
      <a href="#openings">Search job openings</a>
      <a href="/careers#openings">See open jobs</a>
      <script id="__NEXT_DATA__" type="application/json">
        {"props":{"pageProps":{"components":[{"componentType":"Search","searchType":"Careers","referenceId":"openings"}]}}}
      </script>
    </main>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 7001,
      title: 'Software Engineer, Payments Platform',
      company_name: 'Lyft',
      location: { name: 'Bangalore, India' },
      absolute_url: 'https://app.careerpuck.com/job-board/lyft/job/7001?gh_jid=7001',
      requisition_id: 'ENG-7001',
      updated_at: '2026-07-15T12:00:00-04:00',
      first_published: '2026-07-14T08:00:00-04:00',
      content: '&lt;p&gt;Build resilient backend systems for Lyft payments in India.&lt;/p&gt;',
      departments: [{ name: 'Engineering' }],
      offices: [{ location: 'Bangalore, Karnataka, India' }],
      metadata: [{ name: 'Career Site Category', value: 'Engineering' }],
    },
    {
      id: 7002,
      title: 'Senior Analyst',
      company_name: 'Lyft',
      location: { name: 'Toronto, Canada' },
      absolute_url: 'https://app.careerpuck.com/job-board/lyft/job/7002?gh_jid=7002',
      requisition_id: 'ANA-7002',
      updated_at: '2026-07-15T12:00:00-04:00',
      first_published: '2026-07-14T08:00:00-04:00',
      content: '&lt;p&gt;Canada only role.&lt;/p&gt;',
      departments: [{ name: 'Analytics' }],
      offices: [{ location: 'Toronto, Ontario, Canada' }],
      metadata: [{ name: 'Career Site Category', value: 'Analytics' }],
    },
  ],
}

const nonIndiaPayload = {
  jobs: [
    {
      id: 8608881002,
      title: 'Account Manager, Healthcare & Transit Partnerships',
      company_name: 'Lyft',
      location: { name: 'New York, NY' },
      absolute_url: 'https://app.careerpuck.com/job-board/lyft/job/8608881002?gh_jid=8608881002',
      requisition_id: '110924',
      updated_at: '2026-07-06T11:46:25-04:00',
      first_published: '2026-06-26T15:30:22-04:00',
      content: '&lt;p&gt;United States only role.&lt;/p&gt;',
      departments: [{ name: 'Lyft Business' }],
      offices: [{ location: 'New York, New York, United States' }],
      metadata: [{ name: 'Career Site Category', value: 'Sales' }],
    },
    {
      id: 8367674002,
      title: 'Analytics Lead, LUS',
      company_name: 'Lyft',
      location: { name: 'Toronto, Canada' },
      absolute_url: 'https://app.careerpuck.com/job-board/lyft/job/8367674002?gh_jid=8367674002',
      requisition_id: '108966',
      updated_at: '2026-07-06T11:46:25-04:00',
      first_published: '2026-02-03T15:30:22-04:00',
      content: '&lt;p&gt;Canada only role.&lt;/p&gt;',
      departments: [{ name: 'Analytics' }],
      offices: [{ location: 'Toronto, Ontario, Canada' }],
      metadata: [{ name: 'Career Site Category', value: 'Analytics' }],
    },
  ],
}

const loadLyftModule = async () => {
  try {
    return await import('../../scraper/lyft/script.js')
  } catch {
    assert.fail('Expected Lyft scraper module at ../../scraper/lyft/script.js')
  }
}

test('Lyft helpers stay pinned to the verified first-party careers shell and Greenhouse payload contract', async () => {
  const lyft = await loadLyftModule()

  assert.equal(lyft.SOURCE, 'lyft')
  assert.equal(lyft.COMPANY, 'Lyft')
  assert.equal(lyft.CAREERS_URL, 'https://www.lyft.com/careers')
  assert.equal(lyft.GREENHOUSE_JOBS_API_URL, 'https://api.greenhouse.io/v1/boards/lyft/jobs')
  assert.equal(
    lyft.buildGreenhouseJobsApiUrl(),
    'https://api.greenhouse.io/v1/boards/lyft/jobs?content=true',
  )
  assert.equal(lyft.hasVerifiedCareersShellSignal(careersHtml), true)
  assert.equal(
    lyft.normalizeCareerPuckJobUrl(
      'https://app.careerpuck.com/job-board/lyft/job/7001?gh_jid=7001',
      7001,
    ),
    'https://app.careerpuck.com/job-board/lyft/job/7001?gh_jid=7001',
  )

  const jobs = lyft.extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
    scrapedAt: '2026-07-16T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Software Engineer, Payments Platform',
    company: 'Lyft',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    link: 'https://app.careerpuck.com/job-board/lyft/job/7001?gh_jid=7001',
    applyUrl: 'https://app.careerpuck.com/job-board/lyft/job/7001?gh_jid=7001',
    sourceUrl: 'https://app.careerpuck.com/job-board/lyft/job/7001?gh_jid=7001',
    source: 'lyft',
    jobId: 7001,
    requisitionId: 'ENG-7001',
    department: 'Engineering',
    employmentType: null,
    experienceRequired: null,
    jobDescription: '<p>Build resilient backend systems for Lyft payments in India.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-15T12:00:00-04:00',
    remoteStatus: 'On-site',
    scrapedAt: '2026-07-16T00:00:00.000Z',
  })
})

test('Lyft registered native/route reader applies its cap after retaining all 170 originals', async () => {
  const lyft = await loadLyftModule()
  const { fixture, replay } = await import('../native-sources/declaredGreenhouseRoutes/fixtureReplay.js')
  const r = replay(), jobs = await lyft.createLyftScraper({ maxJobs: 1 }).run(r.options)
  assert.equal(r.audits[0].observations.length, 170)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, fixture.oracle.lyft.records.find(row => row.indiaCandidate).id)
})

test('Lyft distinguishes discovery records with unresolved location scope from India-zero authority', async () => {
  const lyft = await loadLyftModule()
  assert.deepEqual(lyft.extractIndiaJobsFromGreenhousePayload(nonIndiaPayload), [])
  const { replay } = await import('../native-sources/declaredGreenhouseRoutes/fixtureReplay.js')
  const { readInventoryEvidence } = await import('../utils/inventoryEvidence.js')
  const r = replay(), jobs = await lyft.createLyftScraper().run(r.options)
  assert.equal(r.audits[0].observations.length, 170)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.ok(jobs.every(job => job.country === 'India' || job.sourceCountryScopeUnresolved))
})

test('Lyft holds current publication after a closing primary declaration failure and rejects decoded-only input', async () => {
  const lyft = await loadLyftModule()
  const { fixture, replay } = await import('../native-sources/declaredGreenhouseRoutes/fixtureReplay.js')
  const r = replay((url, page, visit) => url === fixture.profiles.lyft.primaryURL && visit === 2 ? { ...page, status: 502 } : page)
  const jobs = await lyft.createLyftScraper().run(r.options)
  assert.equal(jobs.length, 0)
  assert.equal(r.audits[0].observations.length, 170)
  assert.ok(r.audits[0].observations.every(job => job.jobDescription && !job.sourceCurrentNativePostingIdentityQualified))
  await assert.rejects(lyft.createLyftScraper().run({ fetchJson: r.options.fetchJson }), /original HTTP/)
})
