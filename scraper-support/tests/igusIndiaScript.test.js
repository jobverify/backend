import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_URL = 'https://www.igus.in/company/career'
const DETAIL_URL = 'https://www.igus.in/company/career/senior-manager'
const APPLY_URL = 'mailto:ppearl@igus.net'

const listingHtml = `
  <html>
    <body>
      <main>
        <section class="jobs">
          <article class="job-card">
            <a href="/company/career/senior-manager">
              <h2>Senior Manager</h2>
            </a>
            <p class="job-location">Bengaluru, Karnataka, India</p>
            <p class="job-department">Sales</p>
          </article>
        </section>
      </main>
    </body>
  </html>
`

const detailHtml = `
  <html>
    <head>
      <title>igus Singapore | Careers</title>
      <meta name="description" content="Singapore careers">
    </head>
    <body>
      <main>
        <nav><a href="/company/career">Career</a></nav>
        <article>
          <h1>Senior Manager</h1>
          <p>Bengaluru, Karnataka, India</p>
          <p>Department: Sales</p>
          <p>Experience: 8+ years</p>
          <div class="job-description">
            <p>Lead key account growth across India.</p>
            <p>Build channel strategy with cross-functional teams.</p>
          </div>
          <a href="mailto:ppearl@igus.net">Apply now</a>
        </article>
      </main>
    </body>
  </html>
`

const loadIgusIndiaModule = async () => {
  try {
    return await import('../../scraper/igusindia/script.js')
  } catch {
    assert.fail('Expected igus India scraper module at ../../scraper/igusindia/script.js')
  }
}

test('run scrapes igus India jobs from the official careers page, enriches the detail page, and keeps the mailto apply handoff', async () => {
  const {
    CAREERS_URL: exportedCareersUrl,
    createIgusIndiaScraper,
    extractListings,
    extractJobDetail,
  } = await loadIgusIndiaModule()

  assert.equal(exportedCareersUrl, CAREERS_URL)
  assert.deepEqual(extractListings(listingHtml), [
    {
      title: 'Senior Manager',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      sourceUrl: DETAIL_URL,
    },
  ])

  assert.deepEqual(extractJobDetail(detailHtml, {
    title: 'Senior Manager',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    sourceUrl: DETAIL_URL,
  }), {
    title: 'Senior Manager',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    jobId: 'senior-manager',
    requisitionId: 'senior-manager',
    sourceUrl: DETAIL_URL,
    applyUrl: APPLY_URL,
    department: 'Sales',
    employmentType: null,
    experienceRequired: '8+ years',
    postingDate: null,
    closingDate: null,
    jobDescription: 'Lead key account growth across India. Build channel strategy with cross-functional teams.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
  })

  const requestedUrls = []
  const jobs = await createIgusIndiaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_URL) return listingHtml
      if (url === DETAIL_URL) return detailHtml
      throw new Error(`Unexpected igus India URL: ${url}`)
    },
    now: () => '2026-07-09T12:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    CAREERS_URL,
    DETAIL_URL,
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Senior Manager',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      jobId: 'senior-manager',
      requisitionId: 'senior-manager',
      sourceUrl: DETAIL_URL,
      applyUrl: APPLY_URL,
      department: 'Sales',
      employmentType: null,
      experienceRequired: '8+ years',
      postingDate: null,
      closingDate: null,
      jobDescription: 'Lead key account growth across India. Build channel strategy with cross-functional teams.',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      company: 'igus India',
      link: APPLY_URL,
      source: 'igusindia',
      scrapedAt: '2026-07-09T12:00:00.000Z',
    },
  ])
})
