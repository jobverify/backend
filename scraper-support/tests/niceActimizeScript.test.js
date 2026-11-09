import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const ACTIMIZE_HANDOFF_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Get In Touch | NICE Actimize</title>
  </head>
  <body>
    <main>
      <h1>Contact Us</h1>
      <a href="https://www.nice.com/careers" target="_blank">Careers</a>
      <p>NICE Actimize helps you assess the risks you face.</p>
    </main>
  </body>
</html>
`

const NICE_FILTERED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>NICE Careers</title>
  </head>
  <body>
    <main>
      <h1>Careers at NiCE</h1>
      <label for="location">Location</label>
      <select id="location" name="location">
        <option value="USA - Remote">USA - Remote</option>
        <option value="India - Pune" selected="">India - Pune</option>
      </select>
      <article>
        <a href="https://boards.eu.greenhouse.io/nice/jobs/4913142101?gh_jid=4913142101">
          Data Scientist, Actimize
        </a>
      </article>
      <article>
        <a href="https://boards.eu.greenhouse.io/nice/jobs/4928151101?gh_jid=4928151101">
          Senior Software Engineer, AI, Actimize(AI Engineer)
        </a>
      </article>
    </main>
  </body>
</html>
`

const GREENHOUSE_PAYLOAD = {
  jobs: [
    {
      id: 4913142101,
      absolute_url: 'https://boards.eu.greenhouse.io/nice/jobs/4913142101?gh_jid=4913142101',
      requisition_id: '11349',
      title: 'Data Scientist, Actimize',
      location: { name: 'India - Pune' },
      first_published: '2026-07-01T10:00:00-04:00',
      updated_at: '2026-07-08T12:00:00-04:00',
      content: '<p>Join the Actimize AI team in Pune.</p>',
      metadata: [
        { name: 'Job Type', value: 'Regular' },
        {
          name: 'Hiring Manager',
          value: {
            name: 'Suyash Mishra',
            email: 'suyash.mishra@niceactimize.com',
          },
        },
        { name: 'Category', value: 'R&D' },
      ],
    },
    {
      id: 4928151101,
      absolute_url: 'https://boards.eu.greenhouse.io/nice/jobs/4928151101?gh_jid=4928151101',
      requisition_id: '11449',
      title: 'Senior Software Engineer, AI',
      location: { name: 'India - Pune' },
      first_published: '2026-07-02T10:00:00-04:00',
      updated_at: '2026-07-09T12:00:00-04:00',
      content: '<p>Actimize AI engineering role for financial crime workflows.</p>',
      metadata: [
        { name: 'Job Type', value: 'Regular' },
        {
          name: 'Hiring Manager',
          value: {
            name: 'Anshuman Chorera',
            email: 'anshuman.chorera@niceactimize.com',
          },
        },
        { name: 'Category', value: 'R&D' },
      ],
    },
    {
      id: 4999999999,
      absolute_url: 'https://boards.eu.greenhouse.io/nice/jobs/4999999999?gh_jid=4999999999',
      requisition_id: '99999',
      title: 'Software Engineer',
      location: { name: 'India - Pune' },
      first_published: '2026-07-02T10:00:00-04:00',
      updated_at: '2026-07-09T12:00:00-04:00',
      content: '<p>General NICE product role.</p>',
      metadata: [
        { name: 'Job Type', value: 'Regular' },
        {
          name: 'Hiring Manager',
          value: {
            name: 'General Manager',
            email: 'manager@nice.com',
          },
        },
        { name: 'Category', value: 'R&D' },
      ],
    },
    {
      id: 4888888888,
      absolute_url: 'https://boards.eu.greenhouse.io/nice/jobs/4888888888?gh_jid=4888888888',
      requisition_id: '88888',
      title: 'Account Executive, Actimize',
      location: { name: 'USA - Remote' },
      first_published: '2026-07-02T10:00:00-04:00',
      updated_at: '2026-07-09T12:00:00-04:00',
      content: '<p>Actimize sales role outside India.</p>',
      metadata: [
        { name: 'Job Type', value: 'Regular' },
        {
          name: 'Hiring Manager',
          value: {
            name: 'US Manager',
            email: 'manager@niceactimize.com',
          },
        },
        { name: 'Category', value: 'Sales' },
      ],
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/niceactimize/script.js')
  } catch {
    assert.fail('Expected NICE Actimize scraper module at ../../scraper/niceactimize/script.js')
  }
}

test('NICE Actimize helpers stay pinned to the verified handoff page, filtered NICE careers page, and Greenhouse API', async () => {
  const niceActimize = await loadModule()

  assert.equal(niceActimize.SOURCE, 'niceactimize')
  assert.equal(niceActimize.COMPANY, 'NICE Actimize')
  assert.equal(niceActimize.OFFICIAL_BRAND_NAME, 'NICE Actimize')
  assert.equal(niceActimize.VERIFIED_ON, '2026-08-13')
  assert.equal(niceActimize.ACTIMIZE_HANDOFF_URL, 'https://www.niceactimize.com/get-in-touch')
  assert.equal(
    niceActimize.NICE_FILTERED_CAREERS_URL,
    'https://www.nice.com/careers/apply?location=India+-+Pune',
  )
  assert.equal(
    niceActimize.GREENHOUSE_JOBS_API_URL,
    'https://boards-api.greenhouse.io/v1/boards/nice/jobs?content=true',
  )
  assert.equal(niceActimize.hasOfficialActimizeHandoffSignal(ACTIMIZE_HANDOFF_HTML), true)
  assert.equal(niceActimize.hasOfficialActimizeHandoffSignal('<html><body>Other</body></html>'), false)
  assert.equal(niceActimize.hasFilteredNiceCareersSignal(NICE_FILTERED_CAREERS_HTML), true)
  assert.equal(niceActimize.hasFilteredNiceCareersSignal('<html><body>No Actimize roles</body></html>'), false)

  assert.equal(niceActimize.isActimizeIndiaJob(GREENHOUSE_PAYLOAD.jobs[0]), true)
  assert.equal(niceActimize.isActimizeIndiaJob(GREENHOUSE_PAYLOAD.jobs[1]), true)
  assert.equal(niceActimize.isActimizeIndiaJob(GREENHOUSE_PAYLOAD.jobs[2]), false)
  assert.equal(niceActimize.isActimizeIndiaJob(GREENHOUSE_PAYLOAD.jobs[3]), false)

  const jobs = niceActimize.extractJobs(GREENHOUSE_PAYLOAD)
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Data Scientist, Actimize',
    company: 'NICE Actimize',
    department: 'R&D',
    location: 'India - Pune',
    city: 'Pune',
    country: 'India',
    jobId: '4913142101',
    requisitionId: '11349',
    sourceUrl: 'https://boards.eu.greenhouse.io/nice/jobs/4913142101?gh_jid=4913142101',
    applyUrl: 'https://boards.eu.greenhouse.io/nice/jobs/4913142101?gh_jid=4913142101',
    employmentType: 'Regular',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-01',
    closingDate: null,
    jobDescription: 'Join the Actimize AI team in Pune.',
  })
})

test('NICE Actimize run validates the first-party handoff page, filtered NICE page, and Greenhouse API before returning jobs', async () => {
  const niceActimize = await loadModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await niceActimize.createNiceActimizeScraper().run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === niceActimize.ACTIMIZE_HANDOFF_URL) return ACTIMIZE_HANDOFF_HTML
      if (url === niceActimize.NICE_FILTERED_CAREERS_URL) return NICE_FILTERED_CAREERS_HTML
      throw new Error(`Unexpected NICE Actimize text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === niceActimize.GREENHOUSE_JOBS_API_URL) return GREENHOUSE_PAYLOAD
      throw new Error(`Unexpected NICE Actimize JSON URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedTextUrls, [
    niceActimize.ACTIMIZE_HANDOFF_URL,
    niceActimize.NICE_FILTERED_CAREERS_URL,
  ])
  assert.deepEqual(requestedJsonUrls, [niceActimize.GREENHOUSE_JOBS_API_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'niceactimize')
  assert.equal(jobs[0].company, 'NICE Actimize')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('NICE Actimize fails closed when the handoff page, filtered NICE page, or Greenhouse payload drift materially', async () => {
  const niceActimize = await loadModule()

  await assert.rejects(
    niceActimize.createNiceActimizeScraper().run({
      fetchText: async () => '<html><body>Unexpected</body></html>',
      fetchJson: async () => GREENHOUSE_PAYLOAD,
    }),
    /verified NICE Actimize handoff page/i,
  )

  await assert.rejects(
    niceActimize.createNiceActimizeScraper().run({
      fetchText: async (url) => {
        if (url === niceActimize.ACTIMIZE_HANDOFF_URL) return ACTIMIZE_HANDOFF_HTML
        return '<html><body>No Actimize roles</body></html>'
      },
      fetchJson: async () => GREENHOUSE_PAYLOAD,
    }),
    /filtered NICE careers page/i,
  )

  await assert.rejects(
    niceActimize.createNiceActimizeScraper().run({
      fetchText: async (url) => {
        if (url === niceActimize.ACTIMIZE_HANDOFF_URL) return ACTIMIZE_HANDOFF_HTML
        return `
          <!doctype html>
          <html>
            <body>
              <h1>Careers at NiCE</h1>
              <select>
                <option value="India - Pune">India - Pune</option>
              </select>
              <a href="https://boards.eu.greenhouse.io/nice/jobs/4913142101?gh_jid=4913142101">
                Data Scientist, Actimize
              </a>
            </body>
          </html>
        `
      },
      fetchJson: async () => GREENHOUSE_PAYLOAD,
    }),
    /filtered NICE careers page/i,
  )

  await assert.rejects(
    niceActimize.createNiceActimizeScraper().run({
      fetchText: async (url) => {
        if (url === niceActimize.ACTIMIZE_HANDOFF_URL) return ACTIMIZE_HANDOFF_HTML
        return NICE_FILTERED_CAREERS_HTML
      },
      fetchJson: async () => ({ jobs: 'unexpected' }),
    }),
    /Greenhouse payload/i,
  )
})
