import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const officialCareersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>SAAL - CAREER</title>
    </head>
    <body>
      <main>
        <h1>Careers</h1>
        <h2>Build Your Careers at SAAL</h2>
        <p>
          SAAL offers a dynamic environment where talent, technology, and ambition come together to accelerate your career.
        </p>
        <p>
          If you’re ready to make an impact and grow with a fast-moving team, SAAL is the place for you.
        </p>
        <a href="https://hrmsadcg.darwinbox.com/ms/candidatev2/a6824906a5ab4c/careers/home">
          Search and View Jobs
        </a>
      </main>
    </body>
  </html>
`

test('Saal AI scraper pins the verified official careers page and Darwinbox handoff', async () => {
  const saalAi = await loadModule()
  assert.ok(saalAi, 'Saal AI scraper module should load')

  const {
    COMPANY_NAME,
    DARWINBOX_COMPANY_ID,
    DARWINBOX_ORIGIN,
    OFFICIAL_CAREERS_URL,
    SOURCE,
    hasOfficialSaalAiCareersSignals,
  } = saalAi

  assert.equal(COMPANY_NAME, 'Saal AI')
  assert.equal(SOURCE, 'saalai')
  assert.equal(OFFICIAL_CAREERS_URL, 'https://saal.ai/careers/')
  assert.equal(DARWINBOX_ORIGIN, 'https://hrmsadcg.darwinbox.com')
  assert.equal(DARWINBOX_COMPANY_ID, 'a6824906a5ab4c')
  assert.equal(hasOfficialSaalAiCareersSignals(officialCareersHtml), true)
})

test('Saal AI scraper validates the official page before returning Darwinbox India jobs', async () => {
  const saalAi = await loadModule()
  assert.ok(saalAi, 'Saal AI scraper module should load')

  const { OFFICIAL_CAREERS_URL, createSaalAiScraper } = saalAi

  const requestedUrls = []
  const requestedPages = []

  const jobs = await createSaalAiScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, OFFICIAL_CAREERS_URL)
      return officialCareersHtml
    },
    fetchListingPage: async ({ page, pageSize, companyId }) => {
      requestedPages.push({ page, pageSize, companyId })

      return {
        data: [
          {
            id: 'saal-001',
            title: 'AI Engineer',
            department_name: 'Engineering',
            locations: 'Bengaluru, Karnataka, India',
            country: 'India',
            emp_type_name: 'Full-time',
            experience: '3 - 5 Years',
            posted_on: '10-Jul-2026',
            jd: '<p>Build applied AI systems.</p>',
          },
          {
            id: 'saal-uae-001',
            title: 'Product Designer',
            department_name: 'Design',
            locations: 'Abu Dhabi, United Arab Emirates',
            country: 'United Arab Emirates',
            emp_type_name: 'Full-time',
            experience: '4 - 6 Years',
            posted_on: '09-Jul-2026',
            jd: '<p>Design enterprise experiences.</p>',
          },
        ],
        job_counts: 2,
      }
    },
  })

  assert.deepEqual(requestedUrls, [OFFICIAL_CAREERS_URL])
  assert.deepEqual(requestedPages, [{
    page: 1,
    pageSize: 10,
    companyId: 'a6824906a5ab4c',
  }])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Saal AI')
  assert.equal(jobs[0].source, 'saalai')
  assert.equal(jobs[0].title, 'AI Engineer')
  assert.equal(jobs[0].location, 'Bengaluru, Karnataka, India')
  assert.equal(jobs[0].city, 'Bengaluru')
  assert.equal(
    jobs[0].sourceUrl,
    'https://hrmsadcg.darwinbox.com/ms/candidatev2/a6824906a5ab4c/careers/jobDetails/saal-001',
  )
  assert.equal(jobs[0].applyUrl, jobs[0].sourceUrl)
  assert.equal(jobs[0].link, jobs[0].sourceUrl)
  assert.match(jobs[0].scrapedAt, /\d{4}-\d{2}-\d{2}T/)
})

test('Saal AI scraper rejects an official careers page that no longer matches the verified public surface', async () => {
  const saalAi = await loadModule()
  assert.ok(saalAi, 'Saal AI scraper module should load')

  await assert.rejects(
    saalAi.createSaalAiScraper().run({
      fetchText: async () => '<html><body>Open roles</body></html>',
      fetchListingPage: async () => ({ data: [], job_counts: 0 }),
    }),
    /verified official careers page/i,
  )
})
