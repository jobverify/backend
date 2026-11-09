import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html>
  <head><title>Global Technology Careers | Mitratech</title></head>
  <body>
    <h1>Current Openings</h1>
    <section>Our People</section>
    <a href="https://job-boards.greenhouse.io/mitratech">View all roles</a>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 12345,
      title: 'Principal Data Engineer',
      company_name: 'Mitratech',
      absolute_url: 'https://job-boards.greenhouse.io/mitratech/jobs/12345',
      requisition_id: 'MT-12345',
      departments: [{ name: 'Engineering' }],
      location: { name: 'Hyderabad, India' },
      offices: [],
      metadata: [],
      content: '<p>Build data infrastructure.</p>',
      updated_at: '2026-08-01T10:00:00Z',
    },
    {
      id: 67890,
      title: 'Senior Product Designer',
      company_name: 'Mitratech',
      absolute_url: 'https://job-boards.greenhouse.io/mitratech/jobs/67890',
      requisition_id: 'MT-67890',
      departments: [{ name: 'Design' }],
      location: { name: 'Austin, United States' },
      offices: [],
      metadata: [],
      content: '<p>Design legal-tech workflows.</p>',
      updated_at: '2026-08-01T11:00:00Z',
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/mitratech/script.js')
  } catch {
    assert.fail('Expected Mitratech scraper module at ../../scraper/mitratech/script.js')
  }
}

test('Mitratech validator stays pinned to the verified Greenhouse board handoff from Saturday, August 1, 2026', async () => {
  const mitratech = await loadModule()
  assert.equal(mitratech.VERIFIED_ON, '2026-08-01')
  assert.equal(mitratech.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(
    mitratech.extractOfficialGreenhouseBoardUrl(careersHtml),
    'https://job-boards.greenhouse.io/mitratech',
  )
  assert.equal(
    mitratech.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/mitratech/jobs?content=true',
  )
  assert.deepEqual(
    mitratech.extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
      scrapedAt: '2026-08-01T00:00:00.000Z',
    }),
    [
      {
        title: 'Principal Data Engineer',
        company: 'Mitratech',
        location: 'Hyderabad, India',
        city: 'Hyderabad',
        country: 'India',
        link: 'https://job-boards.greenhouse.io/mitratech/jobs/12345',
        applyUrl: 'https://job-boards.greenhouse.io/mitratech/jobs/12345',
        sourceUrl: 'https://job-boards.greenhouse.io/mitratech/jobs/12345',
        source: 'mitratech',
        jobId: '12345',
        requisitionId: 'MT-12345',
        department: 'Engineering',
        employmentType: null,
        experienceRequired: null,
        jobDescription: 'Build data infrastructure.',
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: '2026-08-01T10:00:00Z',
        closingDate: null,
        scrapedAt: '2026-08-01T00:00:00.000Z',
      },
    ],
  )
})

test('Mitratech run validates the official careers handoff and returns only India jobs from Greenhouse', async () => {
  const mitratech = await loadModule()
  const jobs = await mitratech.createMitratechScraper().run({
    fetchText: async () => careersHtml,
    fetchJson: async (url) => {
      assert.equal(
        url,
        'https://boards-api.greenhouse.io/v1/boards/mitratech/jobs?content=true',
      )
      return greenhousePayload
    },
    now: () => '2026-08-01T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Principal Data Engineer')
  assert.equal(jobs[0].city, 'Hyderabad')
  assert.equal(jobs[0].source, 'mitratech')
  assert.equal(jobs[0].scrapedAt, '2026-08-01T00:00:00.000Z')
})
