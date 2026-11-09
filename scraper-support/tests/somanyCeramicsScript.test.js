import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Somany Ceramics</title>
  </head>
  <body>
    <main>
      <h1>Opportunities that grow with you.</h1>
      <h2>Work With Us</h2>
      <p>What are you looking for today? Begin your exploration below.</p>
      <p>Tiles Bathware Waterproofing Adhesive Plant Commercial</p>

      <article class="career-card">
        <p>Designation</p>
        <h3>Area Sales Manager</h3>
        <p>Job Location</p>
        <p>Agra</p>
        <p>Work Type</p>
        <p>Remote</p>
        <a href="https://v2.app.goodfit.so/jobs/somany-ceramics-tiles/Area-Sales-Manager-Agra?id=8e35b993-a160-4816-bb19-2414c5a518b4">
          Know More
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"></svg>
        </a>
      </article>

      <article class="career-card">
        <p>Designation</p>
        <h3>Senior Territory Manager - CPD Sales</h3>
        <p>Job Location</p>
        <p>Delhi</p>
        <p>Work Type</p>
        <p>Remote</p>
        <a href="https://v2.app.goodfit.so/jobs/somany-ceramics-tiles/Senior-Territory-Manager-CPD-Sales?id=f6948b4f-b359-4ea0-8d04-e249cc631d0a">Know More</a>
      </article>

      <article class="career-card">
        <p>Designation</p>
        <h3>DM- Business Development</h3>
        <p>Job Location</p>
        <p>Remote</p>
        <p>Work Type</p>
        <p>Remote</p>
        <a href="https://v2.app.goodfit.so/jobs/somany-ceramics-tiles/DM-Business-Development?id=988546a0-e9f9-4ba0-b298-63b6227fdabc">Know More</a>
      </article>
    </main>
  </body>
</html>
`

const DRIFTED_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Somany Careers</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>No jobs today.</p>
    </main>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/somanyceramics/script.js')
  } catch {
    assert.fail('Expected Somany Ceramics scraper module at ../../scraper/somanyceramics/script.js')
  }
}

test('Somany Ceramics helpers stay pinned to the verified first-party page and extract inline Goodfit job cards', async () => {
  const somanyCeramics = await loadScriptModule()

  assert.equal(somanyCeramics.SOURCE, 'somanyceramics')
  assert.equal(somanyCeramics.COMPANY_NAME, 'Somany Ceramics')
  assert.equal(somanyCeramics.OFFICIAL_BRAND_NAME, 'Somany Ceramics Limited')
  assert.equal(somanyCeramics.VERIFIED_ON, '2026-07-27')
  assert.equal(somanyCeramics.CAREERS_URL, 'https://www.somanyceramics.com/work-with-us')
  assert.equal(somanyCeramics.GOODFIT_HOST, 'https://v2.app.goodfit.so')
  assert.equal(somanyCeramics.hasOfficialCareersPageSignal(CAREERS_PAGE_HTML), true)

  assert.deepEqual(somanyCeramics.extractJobCards(CAREERS_PAGE_HTML), [
    {
      title: 'Area Sales Manager',
      company: 'Somany Ceramics',
      department: 'Tiles',
      location: 'Agra, India',
      city: 'Agra',
      workType: 'Remote',
      employmentType: null,
      jobId: '8e35b993-a160-4816-bb19-2414c5a518b4',
      sourceUrl: 'https://v2.app.goodfit.so/jobs/somany-ceramics-tiles/Area-Sales-Manager-Agra?id=8e35b993-a160-4816-bb19-2414c5a518b4',
      applyUrl: 'https://v2.app.goodfit.so/jobs/somany-ceramics-tiles/Area-Sales-Manager-Agra?id=8e35b993-a160-4816-bb19-2414c5a518b4',
      jobDescription: null,
    },
    {
      title: 'Senior Territory Manager - CPD Sales',
      company: 'Somany Ceramics',
      department: 'Tiles',
      location: 'Delhi, India',
      city: 'Delhi',
      workType: 'Remote',
      employmentType: null,
      jobId: 'f6948b4f-b359-4ea0-8d04-e249cc631d0a',
      sourceUrl: 'https://v2.app.goodfit.so/jobs/somany-ceramics-tiles/Senior-Territory-Manager-CPD-Sales?id=f6948b4f-b359-4ea0-8d04-e249cc631d0a',
      applyUrl: 'https://v2.app.goodfit.so/jobs/somany-ceramics-tiles/Senior-Territory-Manager-CPD-Sales?id=f6948b4f-b359-4ea0-8d04-e249cc631d0a',
      jobDescription: null,
    },
    {
      title: 'DM- Business Development',
      company: 'Somany Ceramics',
      department: 'Tiles',
      location: 'Remote',
      city: null,
      workType: 'Remote',
      employmentType: null,
      jobId: '988546a0-e9f9-4ba0-b298-63b6227fdabc',
      sourceUrl: 'https://v2.app.goodfit.so/jobs/somany-ceramics-tiles/DM-Business-Development?id=988546a0-e9f9-4ba0-b298-63b6227fdabc',
      applyUrl: 'https://v2.app.goodfit.so/jobs/somany-ceramics-tiles/DM-Business-Development?id=988546a0-e9f9-4ba0-b298-63b6227fdabc',
      jobDescription: null,
    },
  ])
})

test('Somany Ceramics run verifies the official page contract and decorates the extracted jobs for the shared runner', async () => {
  const somanyCeramics = await loadScriptModule()
  const requestedUrls = []

  const jobs = await somanyCeramics.createSomanyCeramicsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === somanyCeramics.CAREERS_URL) return CAREERS_PAGE_HTML
      throw new Error(`Unexpected Somany Ceramics URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [somanyCeramics.CAREERS_URL])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'somanyceramics')
  assert.equal(jobs[0].company, 'Somany Ceramics')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[1].title, 'Senior Territory Manager - CPD Sales')
  assert.equal(jobs[2].location, 'Remote')
  assert.ok(jobs.every((job) => typeof job.scrapedAt === 'string' && job.scrapedAt.length > 0))
})

test('Somany Ceramics fails closed when the verified careers surface drifts or the inline Goodfit cards disappear', async () => {
  const somanyCeramics = await loadScriptModule()

  await assert.rejects(
    somanyCeramics.createSomanyCeramicsScraper().run({
      fetchText: async () => DRIFTED_PAGE_HTML,
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    somanyCeramics.createSomanyCeramicsScraper().run({
      fetchText: async () => CAREERS_PAGE_HTML.replace(/<a href="https:\/\/v2\.app\.goodfit\.so[\s\S]*?<\/a>/gi, ''),
    }),
    /public job cards/i,
  )
})
