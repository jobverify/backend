import assert from 'node:assert/strict'
import test from 'node:test'

import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const loadInctureModule = async () => {
  try {
    return await import('../../scraper/incture/script.js')
  } catch {
    assert.fail('Expected Incture scraper module at ../../scraper/incture/script.js')
  }
}

const officialCareersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers | Incture</title>
      <link rel="canonical" href="https://incture.com/careers/">
    </head>
    <body>
      <main>
        <h1>Careers at Incture</h1>
        <p>Shape digital innovation with our global teams.</p>
        <a href="https://incture.zohorecruit.com/jobs/Careers">View Open Roles</a>
      </main>
    </body>
  </html>
`

const officialPortalHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Jobs at Incture</title>
      <meta property="og:url" content="https://incture.zohorecruit.com/jobs/Careers">
    </head>
    <body>
      <input type="hidden" id="pageJson" value="{}">
      <input type="hidden" id="moduleMeta" value="[]">
      <input type="hidden" id="jobs" value="[]">

      <article class="job-card">
        <h2>
          <a href="https://incture.zohorecruit.com/jobs/Careers/90010000000012345/Senior-Software-Engineer?source=CareerSite">
            Senior Software Engineer
          </a>
        </h2>
        <p>Location: Bengaluru, India</p>
        <a href="https://incture.zohorecruit.com/jobs/Careers/90010000000012345/Senior-Software-Engineer?source=CareerSite">Apply</a>
        <section>
          <h3>Job Description</h3>
          <p>Build SAP commerce integrations for enterprise retail clients.</p>
        </section>
      </article>

      <article class="job-card">
        <h2>
          <a href="https://incture.zohorecruit.com/jobs/Careers/90010000000012346/Associate-Consultant?source=CareerSite">
            Associate Consultant
          </a>
        </h2>
        <p>Location: Mysuru</p>
        <a href="https://incture.zohorecruit.com/jobs/Careers/90010000000012346/Associate-Consultant?source=CareerSite">Apply</a>
        <section>
          <h3>Job Description</h3>
          <p>Support rollout and application managed services projects.</p>
        </section>
      </article>

      <article class="job-card">
        <h2>
          <a href="https://incture.zohorecruit.com/jobs/Careers/90010000000012347/US-Sales-Director?source=CareerSite">
            US Sales Director
          </a>
        </h2>
        <p>Location: Austin, United States</p>
        <a href="https://incture.zohorecruit.com/jobs/Careers/90010000000012347/US-Sales-Director?source=CareerSite">Apply</a>
        <section>
          <h3>Job Description</h3>
          <p>Lead public-sector sales strategy in North America.</p>
        </section>
      </article>
    </body>
  </html>
`

const nonIndiaPortalHtml = officialPortalHtml
  .replace('Location: Bengaluru, India', 'Location: Austin, United States')
  .replace('Location: Mysuru', 'Location: Berlin, Germany')

test('Incture constants stay pinned to the official careers surfaces and portal markers', async () => {
  const incture = await loadInctureModule()

  assert.equal(incture.CAREERS_URL, 'https://incture.com/careers/')
  assert.equal(incture.CAREERS_PORTAL_URL, 'https://incture.zohorecruit.com/jobs/Careers')
  assert.equal(incture.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(incture.hasOfficialPortalSignal(officialPortalHtml), true)
})

test('extractIndiaJobs returns zero-or-more India job summaries from representative Incture Zoho HTML', async () => {
  const incture = await loadInctureModule()

  assert.deepEqual(incture.extractIndiaJobs(officialPortalHtml), [
    {
      title: 'Senior Software Engineer',
      company: 'Incture',
      department: null,
      location: 'Bengaluru, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '90010000000012345',
      requisitionId: '90010000000012345',
      sourceUrl: 'https://incture.zohorecruit.com/jobs/Careers/90010000000012345/Senior-Software-Engineer?source=CareerSite',
      applyUrl: 'https://incture.zohorecruit.com/jobs/Careers/90010000000012345/Senior-Software-Engineer?source=CareerSite',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Build SAP commerce integrations for enterprise retail clients.',
    },
    {
      title: 'Associate Consultant',
      company: 'Incture',
      department: null,
      location: 'Mysuru',
      city: 'Mysuru',
      country: 'India',
      jobId: '90010000000012346',
      requisitionId: '90010000000012346',
      sourceUrl: 'https://incture.zohorecruit.com/jobs/Careers/90010000000012346/Associate-Consultant?source=CareerSite',
      applyUrl: 'https://incture.zohorecruit.com/jobs/Careers/90010000000012346/Associate-Consultant?source=CareerSite',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Support rollout and application managed services projects.',
    },
  ])
})

test('run validates the official careers page before fetching and decorating Incture India jobs', async () => {
  const incture = await loadInctureModule()
  const requestedUrls = []

  const jobs = await incture.createInctureScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === incture.CAREERS_URL) return officialCareersHtml
      if (url === incture.CAREERS_PORTAL_URL) return officialPortalHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-09T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    incture.CAREERS_URL,
    incture.CAREERS_PORTAL_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'incture')
  assert.equal(
    jobs[0].link,
    'https://incture.zohorecruit.com/jobs/Careers/90010000000012345/Senior-Software-Engineer?source=CareerSite',
  )
  assert.equal(jobs[0].scrapedAt, '2026-07-09T00:00:00.000Z')
})

test('run attaches complete-inventory evidence when the official Incture portal has zero India jobs', async () => {
  const incture = await loadInctureModule()

  const jobs = await incture.createInctureScraper().run({
    fetchText: async (url) => {
      if (url === incture.CAREERS_URL) return officialCareersHtml
      if (url === incture.CAREERS_PORTAL_URL) return nonIndiaPortalHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-09-14T00:00:00.000Z',
  })

  const inventoryEvidence = readInventoryEvidence(jobs)

  assert.deepEqual(jobs, [])
  assert.equal(inventoryEvidence?.status, 'complete-inventory')
  assert.equal(inventoryEvidence?.reportedTotal, 3)
  assert.equal(inventoryEvidence?.indiaFacetCount, 0)
})

test('run fails closed when the official Incture careers page signal disappears', async () => {
  const incture = await loadInctureModule()

  await assert.rejects(
    incture.createInctureScraper().run({
      fetchText: async () => '<html><body>Unexpected page</body></html>',
    }),
    /official Incture careers page/i,
  )
})
