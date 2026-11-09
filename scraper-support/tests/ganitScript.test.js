import assert from 'node:assert/strict'
import test from 'node:test'

const loadGanitModule = async () => {
  try {
    return await import('../../scraper/ganit/script.js')
  } catch {
    assert.fail('Expected Ganit scraper module at ../../scraper/ganit/script.js')
  }
}

const officialCareersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers | Ganit</title>
      <link rel="canonical" href="https://www.ganitinc.com/careers">
    </head>
    <body>
      <main>
        <h1>Build your future with Ganit</h1>
        <p>Explore current openings across consulting, analytics, and engineering.</p>

        <article class="job-card">
          <h2>
            <a href="https://ganitinc.zohorecruit.in/jobs/Careers/37458000001567097/Sr-Executive---Sales?source=CareerSite">
              Sr Executive - Sales
            </a>
          </h2>
          <p>Location: Bengaluru, India</p>
          <p>Department: Sales</p>
          <p>Employment Type: Full Time</p>
          <p>Drive pipeline development and strategic account growth for enterprise analytics engagements.</p>
        </article>

        <article class="job-card">
          <h2>
            <a href="https://ganitinc.zohorecruit.in/jobs/Careers/37458000001567123/Lead-Data-Engineer?source=CareerSite">
              Lead Data Engineer
            </a>
          </h2>
          <p>Location: Gurugram, India</p>
          <p>Department: Engineering</p>
          <p>Employment Type: Full Time</p>
          <p>Design data pipelines and production-grade platform services for analytics products.</p>
        </article>

        <article class="job-card">
          <h2>
            <a href="https://ganitinc.zohorecruit.in/jobs/Careers/37458000001567999/US-Analytics-Partner?source=CareerSite">
              US Analytics Partner
            </a>
          </h2>
          <p>Location: New York, United States</p>
          <p>Department: Consulting</p>
          <p>Employment Type: Full Time</p>
          <p>Own strategic client relationships for North American growth accounts.</p>
        </article>
      </main>
    </body>
  </html>
`

const currentOfficialCareersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Ganit | Data Speaks</title>
    </head>
    <body>
      <main>
        <section>
          <h1>Discover why Ganit</h1>
          <p>Democratize AI and ML for world-class clients.</p>
        </section>

        <section>
          <h2>Current Opportunities</h2>
          <div class="job-card">
            <h3>Sr Executive - Sales Location - Delhi</h3>
            <a
              href="https://ganitinc.zohorecruit.in/jobs/Careers/37458000001567097/Sr-Executive---Sales?source=CareerSite"
              target="_blank"
              rel="noopener noreferrer"
            >
              know more
            </a>
          </div>
        </section>

        <section>
          <h2>Intern @ Ganit</h2>
          <p>We take in interns all year long.</p>
        </section>
      </main>
    </body>
  </html>
`

test('Ganit constants and official page signal stay pinned to the verified public careers page', async () => {
  const ganit = await loadGanitModule()

  assert.equal(ganit.CAREERS_URL, 'https://www.ganitinc.com/careers')
  assert.equal(ganit.COMPANY, 'Ganit')
  assert.equal(ganit.SOURCE, 'ganit')
  assert.equal(
    ganit.hasOfficialCareersSignal(officialCareersHtml),
    true,
  )
})

test('Ganit accepts the current official careers shell and extracts India roles from the single-card live layout', async () => {
  const ganit = await loadGanitModule()

  assert.equal(ganit.hasOfficialCareersSignal(currentOfficialCareersHtml), true)
  assert.deepEqual(ganit.extractIndiaJobs(currentOfficialCareersHtml), [
    {
      title: 'Sr Executive - Sales',
      company: 'Ganit',
      department: null,
      location: 'Delhi',
      city: 'Delhi',
      country: 'India',
      jobId: '37458000001567097',
      requisitionId: '37458000001567097',
      sourceUrl: 'https://ganitinc.zohorecruit.in/jobs/Careers/37458000001567097/Sr-Executive---Sales?source=CareerSite',
      applyUrl: 'https://ganitinc.zohorecruit.in/jobs/Careers/37458000001567097/Sr-Executive---Sales?source=CareerSite',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
  ])
})

test('extractIndiaJobs keeps India roles from the official Ganit careers page and preserves Zoho detail handoff URLs', async () => {
  const ganit = await loadGanitModule()

  assert.deepEqual(ganit.extractIndiaJobs(officialCareersHtml), [
    {
      title: 'Sr Executive - Sales',
      company: 'Ganit',
      department: 'Sales',
      location: 'Bengaluru, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '37458000001567097',
      requisitionId: '37458000001567097',
      sourceUrl: 'https://ganitinc.zohorecruit.in/jobs/Careers/37458000001567097/Sr-Executive---Sales?source=CareerSite',
      applyUrl: 'https://ganitinc.zohorecruit.in/jobs/Careers/37458000001567097/Sr-Executive---Sales?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Drive pipeline development and strategic account growth for enterprise analytics engagements.',
    },
    {
      title: 'Lead Data Engineer',
      company: 'Ganit',
      department: 'Engineering',
      location: 'Gurugram, India',
      city: 'Gurgaon',
      country: 'India',
      jobId: '37458000001567123',
      requisitionId: '37458000001567123',
      sourceUrl: 'https://ganitinc.zohorecruit.in/jobs/Careers/37458000001567123/Lead-Data-Engineer?source=CareerSite',
      applyUrl: 'https://ganitinc.zohorecruit.in/jobs/Careers/37458000001567123/Lead-Data-Engineer?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Design data pipelines and production-grade platform services for analytics products.',
    },
  ])
})

test('run validates the official Ganit careers page and decorates shared runner fields', async () => {
  const ganit = await loadGanitModule()
  const requestedUrls = []

  const jobs = await ganit.createGanitScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === ganit.CAREERS_URL) return officialCareersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-09T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, ['https://www.ganitinc.com/careers'])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'ganit')
  assert.equal(
    jobs[0].link,
    'https://ganitinc.zohorecruit.in/jobs/Careers/37458000001567097/Sr-Executive---Sales?source=CareerSite',
  )
  assert.equal(jobs[0].scrapedAt, '2026-07-09T00:00:00.000Z')
})

test('run fails closed when the official Ganit careers page signal disappears', async () => {
  const ganit = await loadGanitModule()

  await assert.rejects(
    ganit.createGanitScraper().run({
      fetchText: async () => '<html><body>Unexpected page</body></html>',
    }),
    /official Ganit careers page/i,
  )
})
