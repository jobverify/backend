import assert from 'node:assert/strict'
import test from 'node:test'

const loadCanvaModule = async () => {
  try {
    return await import('../../scraper/canva/script.js')
  } catch {
    assert.fail('Expected Canva scraper module at ../../scraper/canva/script.js')
  }
}

const pageOneHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Find Authentic Jobs | Canva Careers</title>
    <link rel="canonical" href="https://www.lifeatcanva.com/en/jobs/" />
  </head>
  <body>
    <main>
      <h1>Find <strong>Authentic Jobs</strong></h1>
      <form>
        <label>Keywords</label>
        <label>Team</label>
        <label>Country</label>
        <label>Location Type</label>
        <label>Work Type</label>
      </form>
      <p>1 to 20 of 4 Live Results</p>

      <section aria-label="Search results">
        <article class="job-card">
          <h2>
            <a href="/en/jobs/6000000001111111/senior-software-engineer-editor-platform/?utm_source=careers">
              Senior Software Engineer - Editor Platform
            </a>
          </h2>
          <button type="button">Save</button>
          <ul>
            <li>Bengaluru, Karnataka, India</li>
            <li>Engineering</li>
          </ul>
        </article>

        <article class="job-card">
          <h2>
            <a href="https://www.lifeatcanva.com/en/jobs/6000000002222222/staff-product-designer-growth/">
              Staff Product Designer - Growth
            </a>
          </h2>
          <button type="button">Save</button>
          <ul>
            <li>Sydney, NSW, Australia</li>
            <li>Design</li>
          </ul>
        </article>
      </section>

      <nav aria-label="Pagination">
        <a href="/en/jobs/?page=1" aria-current="page">1</a>
        <a href="/en/jobs/?page=2">2</a>
      </nav>
    </main>
  </body>
</html>
`

const pageTwoHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Find Authentic Jobs | Canva Careers - Page 2</title>
    <link rel="canonical" href="https://www.lifeatcanva.com/en/jobs/?page=2" />
  </head>
  <body>
    <main>
      <h1>Find Authentic Jobs</h1>
      <form>
        <label>Keywords</label>
        <label>Team</label>
        <label>Country</label>
        <label>Location Type</label>
        <label>Work Type</label>
      </form>
      <p>1 to 20 of 4 Live Results</p>

      <section aria-label="Search results">
        <article class="job-card">
          <h2>
            <a href="/en/jobs/6000000003333333/machine-learning-engineer-safety/">
              Machine Learning Engineer, Safety
            </a>
          </h2>
          <button type="button">Save</button>
          <ul>
            <li>Remote, India</li>
            <li>Engineering</li>
          </ul>
        </article>

        <article class="job-card">
          <h2>
            <a href="/en/jobs/6000000004444444/platform-product-manager/">
              Platform Product Manager
            </a>
          </h2>
          <button type="button">Save</button>
          <ul>
            <li>Bangalore, India</li>
            <li>Product Management</li>
          </ul>
        </article>
      </section>

      <nav aria-label="Pagination">
        <a href="/en/jobs/?page=1">1</a>
        <a href="/en/jobs/?page=2" aria-current="page">2</a>
      </nav>
    </main>
  </body>
</html>
`

test('Canva helpers stay pinned to the verified first-party jobs board contract', async () => {
  const canva = await loadCanvaModule()

  assert.equal(canva.SOURCE, 'canva')
  assert.equal(canva.COMPANY, 'Canva')
  assert.equal(canva.CAREERS_URL, 'https://www.lifeatcanva.com/en/jobs/')
  assert.equal(canva.buildJobsPageUrl(), 'https://www.lifeatcanva.com/en/jobs/')
  assert.equal(canva.buildJobsPageUrl({ page: 2 }), 'https://www.lifeatcanva.com/en/jobs/?page=2')
  assert.equal(canva.hasOfficialJobsPageSignal(pageOneHtml), true)
  assert.equal(canva.hasOfficialJobsPageSignal(pageOneHtml.replace(
    '<h1>Find <strong>Authentic Jobs</strong></h1>', '<h1>Find your <strong>dream job</strong></h1>',
  )), false)
  assert.equal(canva.hasOfficialJobsPageSignal(pageOneHtml.replace(
    '<h1>Find <strong>Authentic Jobs</strong></h1>', '',
  )), false)
  assert.equal(
    canva.normalizeCanvaJobUrl(
      'https://www.lifeatcanva.com/en/jobs/6000000001111111/senior-software-engineer-editor-platform/?utm_source=careers#apply',
    ),
    'https://www.lifeatcanva.com/en/jobs/6000000001111111/senior-software-engineer-editor-platform/',
  )

  assert.deepEqual(canva.extractPaginationSummary(pageTwoHtml), {
    currentPage: 2,
    totalPages: 2,
    hasNext: false,
    totalJobCount: 4,
  })

  assert.deepEqual(canva.extractIndiaJobCardsFromPage(pageOneHtml), [
    {
      title: 'Senior Software Engineer - Editor Platform',
      location: 'Bengaluru, Karnataka, India',
      department: 'Engineering',
      sourceUrl: 'https://www.lifeatcanva.com/en/jobs/6000000001111111/senior-software-engineer-editor-platform/',
      jobId: '6000000001111111',
      requisitionId: '6000000001111111',
    },
  ])
})

test('Canva run paginates the official first-party jobs board and keeps only India roles', async () => {
  const canva = await loadCanvaModule()
  const requestedUrls = []

  const jobs = await canva.createCanvaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === canva.CAREERS_URL) return pageOneHtml
      if (url === canva.buildJobsPageUrl({ page: 2 })) return pageTwoHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-14T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    canva.CAREERS_URL,
    canva.buildJobsPageUrl({ page: 2 }),
  ])
  assert.equal(jobs.length, 3)

  assert.deepEqual(jobs[0], {
    title: 'Senior Software Engineer - Editor Platform',
    company: 'Canva',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bangalore',
    country: 'India',
    link: 'https://www.lifeatcanva.com/en/jobs/6000000001111111/senior-software-engineer-editor-platform/',
    applyUrl: 'https://www.lifeatcanva.com/en/jobs/6000000001111111/senior-software-engineer-editor-platform/',
    sourceUrl: 'https://www.lifeatcanva.com/en/jobs/6000000001111111/senior-software-engineer-editor-platform/',
    source: 'canva',
    jobId: '6000000001111111',
    requisitionId: '6000000001111111',
    department: 'Engineering',
    employmentType: null,
    experienceRequired: null,
    jobDescription: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    remoteStatus: 'On-site',
    scrapedAt: '2026-07-14T00:00:00.000Z',
    sourceListingComplete: false,
    sourceScopeComplete: false,
    lifecycleCleanupAllowed: false,
  })

  assert.deepEqual(jobs[1], {
    title: 'Machine Learning Engineer, Safety',
    company: 'Canva',
    location: 'Remote, India',
    city: 'Remote',
    country: 'India',
    link: 'https://www.lifeatcanva.com/en/jobs/6000000003333333/machine-learning-engineer-safety/',
    applyUrl: 'https://www.lifeatcanva.com/en/jobs/6000000003333333/machine-learning-engineer-safety/',
    sourceUrl: 'https://www.lifeatcanva.com/en/jobs/6000000003333333/machine-learning-engineer-safety/',
    source: 'canva',
    jobId: '6000000003333333',
    requisitionId: '6000000003333333',
    department: 'Engineering',
    employmentType: null,
    experienceRequired: null,
    jobDescription: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    remoteStatus: 'Remote',
    scrapedAt: '2026-07-14T00:00:00.000Z',
    sourceListingComplete: false,
    sourceScopeComplete: false,
    lifecycleCleanupAllowed: false,
  })

  assert.equal(jobs[2].title, 'Platform Product Manager')
  assert.equal(jobs[2].city, 'Bangalore')
  assert.equal(jobs[2].department, 'Product Management')
  assert.equal(jobs[2].remoteStatus, 'On-site')
})

test('Canva stays API-only and surfaces direct-request failures without a browser fallback', async () => {
  const canva = await loadCanvaModule()

  await assert.rejects(
    canva.createCanvaScraper({ maxJobs: 1 }).run({
      fetchText: async () => {
        throw new Error(`HTTP 403 for ${canva.CAREERS_URL}`)
      },
    }),
    /HTTP 403 for https:\/\/www\.lifeatcanva\.com\/en\/jobs\//,
  )
})

test('Canva fails closed when the verified jobs surface or first-party job URLs change', async () => {
  const canva = await loadCanvaModule()

  await assert.rejects(
    canva.createCanvaScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified official canva jobs surface/i,
  )

  await assert.rejects(
    canva.createCanvaScraper().run({
      fetchText: async () => pageOneHtml.replace(
        /href="\/en\/jobs\/6000000001111111\/senior-software-engineer-editor-platform\/\?utm_source=careers"/,
        'href="https://boards.greenhouse.io/canva/jobs/6000000001111111"',
      ),
    }),
    /verified first-party canva job urls/i,
  )

  await assert.rejects(
    canva.createCanvaScraper().run({
      fetchText: async (url) => {
        if (url === canva.CAREERS_URL) return pageOneHtml
        return '<html><body><h1>Unexpected page</h1></body></html>'
      },
    }),
    /verified official canva jobs surface/i,
  )
})
