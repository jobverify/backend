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
      <title>Careers | Synamedia</title>
    </head>
    <body>
      <main>
        <h1>Join us and transform the way the world is entertained and informed</h1>
        <p>
          Discover opportunities to grow your career with Synamedia and play a part in shaping the future of our industry.
          Browse our <a href="https://synamedia.darwinbox.com/ms/candidatev2/main/careers/allJobs">current vacancies</a>
          to see where you could make an impact and take the next step towards joining our team.
        </p>
        <a href="https://synamedia.darwinbox.com/ms/candidatev2/main/careers/allJobs">View open roles</a>
        <a href="https://synamedia.sumtotal.host/core/pillarRedirect?relyingParty=LM&url=app%2Fmanagement%2FLMS_232000%2FLearningEventSearch%3FreturnToSearchResults%3D%255Bobject%2520Object%255D">Apply today</a>
      </main>
    </body>
  </html>
`

test('Synamedia scraper pins the verified official careers page and Darwinbox handoff', async () => {
  const synamedia = await loadModule()
  assert.ok(synamedia, 'Synamedia scraper module should load')

  const {
    COMPANY_NAME,
    DARWINBOX_COMPANY_ID,
    DARWINBOX_ORIGIN,
    OFFICIAL_CAREERS_URL,
    SOURCE,
    hasOfficialSynamediaCareersSignals,
  } = synamedia

  assert.equal(COMPANY_NAME, 'Synamedia')
  assert.equal(SOURCE, 'synamedia')
  assert.equal(OFFICIAL_CAREERS_URL, 'https://www.synamedia.com/careers/')
  assert.equal(DARWINBOX_ORIGIN, 'https://synamedia.darwinbox.com')
  assert.equal(DARWINBOX_COMPANY_ID, 'main')
  assert.equal(hasOfficialSynamediaCareersSignals(officialCareersHtml), true)
})

test('Synamedia scraper validates the official page before returning India jobs from Darwinbox', async () => {
  const synamedia = await loadModule()
  assert.ok(synamedia, 'Synamedia scraper module should load')

  const { OFFICIAL_CAREERS_URL, createSynamediaScraper } = synamedia

  const requestedUrls = []
  const requestedPages = []

  const jobs = await createSynamediaScraper({ maxJobs: 1 }).run({
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
            id: 'syn-001',
            title: 'Senior Software Engineer',
            department_name: 'Engineering',
            locations: 'Bengaluru, Karnataka, India',
            country: 'India',
            emp_type_name: 'Full-time',
            experience: '6 - 9 Years',
            posted_on: '09-Jul-2026',
            jd: '<p>Build video delivery platforms.</p>',
          },
          {
            id: 'syn-us-001',
            title: 'Solutions Architect',
            department_name: 'Customer Success',
            locations: 'Atlanta, Georgia, United States',
            country: 'United States',
            emp_type_name: 'Full-time',
            experience: '8 - 12 Years',
            posted_on: '08-Jul-2026',
            jd: '<p>Support North America customers.</p>',
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
    companyId: 'main',
  }])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Synamedia')
  assert.equal(jobs[0].source, 'synamedia')
  assert.equal(jobs[0].title, 'Senior Software Engineer')
  assert.equal(jobs[0].location, 'Bengaluru, Karnataka, India')
  assert.equal(jobs[0].city, 'Bengaluru')
  assert.equal(
    jobs[0].sourceUrl,
    'https://synamedia.darwinbox.com/ms/candidatev2/main/careers/jobDetails/syn-001',
  )
  assert.equal(jobs[0].applyUrl, jobs[0].sourceUrl)
  assert.equal(jobs[0].link, jobs[0].sourceUrl)
  assert.match(jobs[0].scrapedAt, /\d{4}-\d{2}-\d{2}T/)
})

test('Synamedia scraper rejects an official careers page that no longer matches the verified public surface', async () => {
  const synamedia = await loadModule()
  assert.ok(synamedia, 'Synamedia scraper module should load')

  await assert.rejects(
    synamedia.createSynamediaScraper().run({
      fetchText: async () => '<html><body>Open roles</body></html>',
      fetchListingPage: async () => ({ data: [], job_counts: 0 }),
    }),
    /verified official careers page/i,
  )
})
